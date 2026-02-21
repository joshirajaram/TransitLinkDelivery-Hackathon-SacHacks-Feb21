from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager, suppress
from typing import Any

import httpx
import xmltodict
from fastapi import FastAPI, HTTPException

from .db import init_db
from .logistics_engine import find_closest_stop_to_downtown_perimeter, find_optimal_bus_line
from .models import BusLocation, BusStop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tld")

UNITRANS_FEED_URL = "https://retro.umoiq.com/service/publicXMLFeed"
POLL_INTERVAL_SECONDS = 15

bus_location_cache: list[BusLocation] = []
cache_lock = asyncio.Lock()


async def fetch_vehicle_locations_xml(client: httpx.AsyncClient) -> str:
    params = {
        "command": "vehicleLocations",
        "a": "unitrans",
        "t": str(int(time.time())),
    }
    response = await client.get(UNITRANS_FEED_URL, params=params)
    response.raise_for_status()
    return response.text


def parse_vehicle_locations_xml(xml_payload: str) -> list[BusLocation]:
    """
    Parses Umo IQ XML payload into BusLocation records.
    Supports payloads where <vehicle> may be a dict or list.
    """
    data = xmltodict.parse(xml_payload)
    if "Error" in data:
        error_msg = data.get("Error", "Unknown UmoIQ error")
        logger.warning("UmoIQ returned error payload: %s", error_msg)
        return []

    body = data.get("body", {})
    vehicles = body.get("vehicle", [])

    if isinstance(vehicles, dict):
        vehicles = [vehicles]

    parsed_locations: list[BusLocation] = []

    def get_attr(record: dict, key: str, default: str | None = None) -> str | None:
        return record.get(f"@{key}", record.get(key, default))

    for vehicle in vehicles:
        try:
            parsed_locations.append(
                BusLocation(
                    vehicle_id=str(get_attr(vehicle, "id", "unknown")),
                    route_tag=str(get_attr(vehicle, "routeTag", "unknown")),
                    latitude=float(get_attr(vehicle, "lat")),
                    longitude=float(get_attr(vehicle, "lon")),
                    heading=float(get_attr(vehicle, "heading"))
                    if get_attr(vehicle, "heading")
                    else None,
                    speed_kmh=float(get_attr(vehicle, "speedKmHr"))
                    if get_attr(vehicle, "speedKmHr")
                    else None,
                    last_reported_epoch_ms=int(get_attr(vehicle, "secsSinceReport"))
                    if get_attr(vehicle, "secsSinceReport")
                    else None,
                )
            )
        except (KeyError, TypeError, ValueError) as exc:
            logger.warning("Skipping malformed vehicle record: %s", exc)

    return parsed_locations


async def poll_unitrans_feed_forever() -> None:
    async with httpx.AsyncClient(timeout=15.0) as client:
        while True:
            try:
                xml_payload = await fetch_vehicle_locations_xml(client)
                parsed_locations = parse_vehicle_locations_xml(xml_payload)
                async with cache_lock:
                    bus_location_cache.clear()
                    bus_location_cache.extend(parsed_locations)
                logger.info("Polled %d bus locations", len(parsed_locations))
            except httpx.HTTPError as exc:
                logger.error("HTTP error while polling feed: %s", exc)
            except Exception as exc:
                logger.exception("Unexpected polling error: %s", exc)

            await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    poller_task = asyncio.create_task(poll_unitrans_feed_forever())
    yield
    poller_task.cancel()
    with suppress(asyncio.CancelledError):
        await poller_task


app = FastAPI(title="Transit-Link Delivery API", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/bus-locations", response_model=list[BusLocation])
async def get_bus_locations() -> list[BusLocation]:
    async with cache_lock:
        return list(bus_location_cache)


@app.get("/match")
async def get_best_line(
    restaurant_lat: float,
    restaurant_lon: float,
    customer_lat: float,
    customer_lon: float,
) -> dict[str, Any]:
    async with cache_lock:
        snapshot = list(bus_location_cache)

    result = find_optimal_bus_line(
        restaurant_coords=(restaurant_lat, restaurant_lon),
        customer_coords=(customer_lat, customer_lon),
        bus_locations=snapshot,
    )

    if result is None:
        raise HTTPException(status_code=503, detail="No bus data available yet")

    return result


@app.post("/closest-stop-to-ddba")
async def closest_stop_to_ddba(stops: list[BusStop]) -> dict[str, Any]:
    result = find_closest_stop_to_downtown_perimeter(stops)
    if result is None:
        raise HTTPException(status_code=400, detail="Provide at least one stop and a valid perimeter")
    return result
