"""
Bus-to-Order Matching Algorithm
Intelligently assigns orders to Unitrans buses based on route, timing, and capacity
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from geopy.distance import geodesic
import logging

logger = logging.getLogger(__name__)


class BusMatch:
    """Represents a matched bus for an order"""
    def __init__(
        self,
        bus_id: str,
        route_name: str,
        estimated_pickup_time: datetime,
        estimated_delivery_time: datetime,
        confidence_score: float,
        distance_to_restaurant: float,
        distance_to_stop: float
    ):
        self.bus_id = bus_id
        self.route_name = route_name
        self.estimated_pickup_time = estimated_pickup_time
        self.estimated_delivery_time = estimated_delivery_time
        self.confidence_score = confidence_score
        self.distance_to_restaurant = distance_to_restaurant
        self.distance_to_stop = distance_to_stop


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two coordinates"""
    return geodesic((lat1, lon1), (lat2, lon2)).kilometers


def find_closest_stop_on_route(
    bus_lat: float,
    bus_lon: float,
    route_stops: List[Dict[str, Any]]
) -> Optional[int]:
    """
    Find the index of the closest stop to the bus's current location on its route.
    
    Args:
        bus_lat: Bus latitude
        bus_lon: Bus longitude
        route_stops: List of stops with 'lat' and 'lon' keys
    
    Returns:
        Index of closest stop, or None if no stops available
    """
    if not route_stops:
        return None
    
    min_distance = float('inf')
    closest_idx = 0
    
    for idx, stop in enumerate(route_stops):
        try:
            stop_lat = float(stop.get('lat', 0))
            stop_lon = float(stop.get('lon', 0))
            distance = calculate_distance(bus_lat, bus_lon, stop_lat, stop_lon)
            if distance < min_distance:
                min_distance = distance
                closest_idx = idx
        except (ValueError, TypeError):
            continue
    
    return closest_idx


def find_stop_index_by_coords(
    target_lat: float,
    target_lon: float,
    route_stops: List[Dict[str, Any]],
    max_distance_km: float = 0.2  # 200 meters tolerance
) -> Optional[int]:
    """
    Find the index of a stop matching the given coordinates.
    
    Args:
        target_lat: Target stop latitude
        target_lon: Target stop longitude
        route_stops: List of stops with 'lat' and 'lon' keys
        max_distance_km: Maximum distance to consider a match
    
    Returns:
        Index of matching stop, or None if no match found
    """
    if not route_stops:
        return None
    
    for idx, stop in enumerate(route_stops):
        try:
            stop_lat = float(stop.get('lat', 0))
            stop_lon = float(stop.get('lon', 0))
            distance = calculate_distance(target_lat, target_lon, stop_lat, stop_lon)
            if distance <= max_distance_km:
                return idx
        except (ValueError, TypeError):
            continue
    
    return None


def calculate_stops_between(
    from_idx: int,
    to_idx: int,
    total_stops: int
) -> int:
    """
    Calculate number of stops between two positions on a route.
    Handles circular routes by taking the shorter path.
    
    Args:
        from_idx: Starting stop index
        to_idx: Destination stop index
        total_stops: Total number of stops on the route
    
    Returns:
        Number of stops between the two positions
    """
    if from_idx == to_idx:
        return 0
    
    # Calculate forward distance
    if to_idx > from_idx:
        forward = to_idx - from_idx
    else:
        # Wrap around
        forward = (total_stops - from_idx) + to_idx
    
    # Calculate backward distance
    if from_idx > to_idx:
        backward = from_idx - to_idx
    else:
        # Wrap around
        backward = (total_stops - to_idx) + from_idx
    
    # Return shorter path
    return min(forward, backward)


def estimate_bus_arrival_time(
    bus_lat: float,
    bus_lon: float,
    dest_lat: float,
    dest_lon: float,
    avg_speed_kmh: float = 20.0,  # Average urban bus speed (fallback)
    route_config: Optional[List[Dict[str, Any]]] = None,
    route_id: Optional[str] = None,
    avg_minutes_per_stop: float = 3.0  # Average time per bus stop including dwell
) -> datetime:
    """
    Estimate when a bus will arrive at a destination.
    
    If route_config and route_id are provided, uses stop-based calculation.
    Otherwise falls back to distance-based calculation.
    
    Args:
        bus_lat: Current bus latitude
        bus_lon: Current bus longitude
        dest_lat: Destination latitude
        dest_lon: Destination longitude
        avg_speed_kmh: Average speed for distance-based fallback
        route_config: List of routes with stop sequences
        route_id: ID of the bus route to use for stop calculation
        avg_minutes_per_stop: Average time per stop (including travel + dwell)
    
    Returns:
        Estimated arrival datetime
    """
    # Try stop-based calculation if route config is available
    if route_config and route_id:
        try:
            # Find the route matching the route_id
            matching_route = None
            for route in route_config:
                if route.get('id') == route_id or route.get('tag') == route_id:
                    matching_route = route
                    break
            
            if matching_route and matching_route.get('stops'):
                route_stops = matching_route['stops']
                
                # Find bus's current stop index
                bus_stop_idx = find_closest_stop_on_route(bus_lat, bus_lon, route_stops)
                
                # Find destination stop index
                dest_stop_idx = find_stop_index_by_coords(dest_lat, dest_lon, route_stops)
                
                if bus_stop_idx is not None and dest_stop_idx is not None:
                    # Calculate stops between current position and destination
                    stops_count = calculate_stops_between(
                        bus_stop_idx,
                        dest_stop_idx,
                        len(route_stops)
                    )
                    
                    # Calculate ETA based on stops
                    travel_time_minutes = stops_count * avg_minutes_per_stop
                    return datetime.now() + timedelta(minutes=travel_time_minutes)
        
        except (KeyError, ValueError, TypeError) as e:
            # Fall through to distance-based calculation
            pass
    
    # Fallback: distance-based calculation
    distance = calculate_distance(bus_lat, bus_lon, dest_lat, dest_lon)
    travel_time_hours = distance / avg_speed_kmh
    travel_time_minutes = travel_time_hours * 60
    return datetime.now() + timedelta(minutes=travel_time_minutes)


def calculate_match_score(
    bus_to_restaurant_distance: float,
    bus_to_stop_distance: float,
    estimated_pickup_time: datetime,
    order_ready_time: datetime,
    delivery_window_start: datetime,
    delivery_window_end: datetime
) -> float:
    """
    Calculate a confidence score (0-100) for bus-order matching
    
    Factors:
    - Distance efficiency (closer is better)
    - Timing alignment (pickup after ready, delivery within window)
    - Route efficiency (restaurant -> stop path)
    """
    score = 100.0
    
    # Penalty for distance (prefer buses already near restaurant)
    # 0.5km or less = no penalty, 2km+ = -30 points
    distance_penalty = min(30, bus_to_restaurant_distance * 15)
    score -= distance_penalty
    
    # Timing score
    pickup_delay = (estimated_pickup_time - order_ready_time).total_seconds() / 60
    if pickup_delay < 0:
        # Bus arrives before order ready - bad
        score -= abs(pickup_delay) * 2
    elif pickup_delay > 30:
        # Bus arrives too late - bad
        score -= (pickup_delay - 30) * 1.5
    else:
        # Optimal timing window (0-30 min after ready)
        score += 10
    
    # Delivery window alignment
    if estimated_pickup_time < delivery_window_start:
        # Too early
        early_minutes = (delivery_window_start - estimated_pickup_time).total_seconds() / 60
        score -= early_minutes * 0.5
    elif estimated_pickup_time > delivery_window_end:
        # Too late
        late_minutes = (estimated_pickup_time - delivery_window_end).total_seconds() / 60
        score -= late_minutes * 2
    
    # Route efficiency bonus (if bus is between restaurant and stop)
    total_direct_distance = calculate_distance(
        bus_to_restaurant_distance, 0,  # Simplified
        bus_to_stop_distance, 0
    )
    if total_direct_distance < bus_to_restaurant_distance + bus_to_stop_distance:
        score += 15  # Bus is on optimal path
    
    return max(0, min(100, score))


def find_best_bus_for_order(
    order: Dict[str, Any],
    restaurant: Dict[str, Any],
    delivery_stop: Dict[str, Any],
    delivery_window: Dict[str, Any],
    active_buses: List[Dict[str, Any]],
    prep_time_minutes: int = 15,
    route_config: Optional[List[Dict[str, Any]]] = None
) -> Optional[BusMatch]:
    """
    Find the best bus to deliver an order
    
    Args:
        order: Order details (id, created_at, etc.)
        restaurant: Restaurant location (lat, lon)
        delivery_stop: Delivery stop location (lat, lon)
        delivery_window: Time window (start_time, end_time)
        active_buses: List of currently running buses with GPS data
        prep_time_minutes: Estimated food preparation time
        route_config: Optional route configuration with stop sequences for accurate ETA
    
    Returns:
        BusMatch object with best bus assignment, or None if no suitable bus
    """
    if not active_buses:
        logger.warning(f"No active buses available for order {order.get('id')}")
        return None
    
    order_ready_time = datetime.now() + timedelta(minutes=prep_time_minutes)
    window_start = datetime.combine(datetime.now().date(), delivery_window['start_time'])
    window_end = datetime.combine(datetime.now().date(), delivery_window['end_time'])
    
    best_match = None
    best_score = 0
    
    for bus in active_buses:
        # Calculate distances
        dist_to_restaurant = calculate_distance(
            bus['latitude'], bus['longitude'],
            restaurant['latitude'], restaurant['longitude']
        )
        
        dist_to_stop = calculate_distance(
            bus['latitude'], bus['longitude'],
            delivery_stop['latitude'], delivery_stop['longitude']
        )
        
        # Get bus route identifier for stop-based ETA calculation
        bus_route_id = bus.get('route_tag') or bus.get('route') or bus.get('route_name')
        
        # Estimate timing with stop-based calculation if route config available
        pickup_time = estimate_bus_arrival_time(
            bus['latitude'], bus['longitude'],
            restaurant['latitude'], restaurant['longitude'],
            route_config=route_config,
            route_id=bus_route_id
        )
        
        delivery_time = estimate_bus_arrival_time(
            restaurant['latitude'], restaurant['longitude'],
            delivery_stop['latitude'], delivery_stop['longitude'],
            route_config=route_config,
            route_id=bus_route_id
        )
        
        # Calculate match score
        score = calculate_match_score(
            dist_to_restaurant,
            dist_to_stop,
            pickup_time,
            order_ready_time,
            window_start,
            window_end
        )
        
        logger.info(
            f"Bus {bus['id']} ({bus['route_name']}): "
            f"score={score:.1f}, "
            f"dist_restaurant={dist_to_restaurant:.2f}km, "
            f"dist_stop={dist_to_stop:.2f}km, "
            f"pickup_eta={pickup_time.strftime('%H:%M')}"
        )
        
        if score > best_score:
            best_score = score
            best_match = BusMatch(
                bus_id=bus['id'],
                route_name=bus['route_name'],
                estimated_pickup_time=pickup_time,
                estimated_delivery_time=delivery_time,
                confidence_score=score,
                distance_to_restaurant=dist_to_restaurant,
                distance_to_stop=dist_to_stop
            )
    
    if best_match and best_match.confidence_score < 30:
        logger.warning(
            f"Best bus match for order {order.get('id')} has low confidence: {best_match.confidence_score:.1f}"
        )
    
    return best_match


def assign_orders_to_buses(
    pending_orders: List[Dict[str, Any]],
    active_buses: List[Dict[str, Any]],
    route_config: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Assign multiple orders to available buses optimally
    
    Args:
        pending_orders: List of pending orders to assign
        active_buses: List of currently active buses
        route_config: Optional route configuration for accurate ETA calculation
    
    Returns:
        Dictionary mapping bus_id to list of assigned orders
    """
    assignments = {}
    
    for order in pending_orders:
        # This would need full order/restaurant/stop data
        # Simplified for now
        best_match = find_best_bus_for_order(
            order,
            order['restaurant'],
            order['stop'],
            order['window'],
            active_buses,
            route_config=route_config
        )
        
        if best_match:
            if best_match.bus_id not in assignments:
                assignments[best_match.bus_id] = []
            
            assignments[best_match.bus_id].append({
                'order': order,
                'match': best_match
            })
    
    return assignments
