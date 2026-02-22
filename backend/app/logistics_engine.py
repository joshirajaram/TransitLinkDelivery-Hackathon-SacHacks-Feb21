from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Optional

from geopy.distance import geodesic
from shapely.geometry import LineString, Point
from shapely.geometry import Polygon
from shapely.ops import nearest_points

from .models import BusLocation, BusStop

DDBA_DOWNTOWN_PERIMETER_COORDS: list[tuple[float, float]] = [
    (38.5472, -121.7489),
    (38.5472, -121.7326),
    (38.5396, -121.7326),
    (38.5396, -121.7489),
]


def get_downtown_route_tags(
    bus_locations: Optional[Iterable[BusLocation]] = None,
    perimeter_coords: list[tuple[float, float]] = DDBA_DOWNTOWN_PERIMETER_COORDS,
) -> set[str]:
    if not bus_locations:
        return set()

    perimeter_polygon = Polygon([(lon, lat) for lat, lon in perimeter_coords])
    tags: set[str] = set()

    for bus in bus_locations:
        if perimeter_polygon.contains(Point(bus.longitude, bus.latitude)):
            tags.add(bus.route_tag.lower())

    return tags


def _distance_meters(a: tuple[float, float], b: tuple[float, float]) -> float:
    return geodesic(a, b).meters


def find_optimal_bus_line(
    restaurant_coords: tuple[float, float],
    customer_coords: tuple[float, float],
    bus_locations: Optional[Iterable[BusLocation]] = None,
) -> Optional[dict]:
    """
    Selects the best Unitrans line for middle-mile delivery.

    Scoring combines:
    1) Bus proximity to restaurant pickup point
    2) Bus proximity to customer dropoff area
    3) Bus proximity to the straight corridor between restaurant and customer
    """
    if not bus_locations:
        return None

    corridor = LineString(
        [
            (restaurant_coords[1], restaurant_coords[0]),
            (customer_coords[1], customer_coords[0]),
        ]
    )

    line_scores: dict[str, list[float]] = defaultdict(list)

    for bus in bus_locations:
        bus_coords = (bus.latitude, bus.longitude)
        bus_point = Point(bus.longitude, bus.latitude)

        pickup_dist_m = _distance_meters(bus_coords, restaurant_coords)
        dropoff_dist_m = _distance_meters(bus_coords, customer_coords)
        corridor_dist_deg = corridor.distance(bus_point)
        corridor_dist_m = corridor_dist_deg * 111_000

        score = (0.45 * pickup_dist_m) + (0.35 * dropoff_dist_m) + (0.20 * corridor_dist_m)
        line_scores[bus.route_tag].append(score)

    best_line, best_scores = min(
        line_scores.items(),
        key=lambda pair: sum(pair[1]) / max(len(pair[1]), 1),
    )

    return {
        "route_tag": best_line,
        "score": round(sum(best_scores) / len(best_scores), 2),
        "sample_size": len(best_scores),
    }


def find_closest_stop_to_downtown_perimeter(
    stops: Iterable[BusStop],
    perimeter_coords: list[tuple[float, float]] = DDBA_DOWNTOWN_PERIMETER_COORDS,
) -> Optional[dict]:
    """
    Returns the Unitrans stop closest to the DDBA downtown perimeter.

    Coordinates are expected as (latitude, longitude).
    Distance is computed in meters using geopy geodesic between:
    - each stop location
    - its nearest point on the downtown polygon boundary
    """
    stop_list = list(stops)
    if not stop_list or len(perimeter_coords) < 3:
        return None

    perimeter_polygon = Polygon([(lon, lat) for lat, lon in perimeter_coords])
    perimeter_boundary = perimeter_polygon.exterior

    best_match: Optional[dict] = None

    for stop in stop_list:
        stop_point = Point(stop.longitude, stop.latitude)
        _, nearest_boundary_point = nearest_points(stop_point, perimeter_boundary)

        distance_m = geodesic(
            (stop.latitude, stop.longitude),
            (nearest_boundary_point.y, nearest_boundary_point.x),
        ).meters

        if best_match is None or distance_m < best_match["distance_to_perimeter_m"]:
            best_match = {
                "stop_id": stop.stop_id,
                "title": stop.title,
                "route_tag": stop.route_tag,
                "distance_to_perimeter_m": round(distance_m, 2),
                "nearest_perimeter_point": {
                    "latitude": round(nearest_boundary_point.y, 6),
                    "longitude": round(nearest_boundary_point.x, 6),
                },
            }

    return best_match
