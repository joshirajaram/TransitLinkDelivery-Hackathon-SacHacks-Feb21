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


def estimate_bus_arrival_time(
    bus_lat: float,
    bus_lon: float,
    dest_lat: float,
    dest_lon: float,
    avg_speed_kmh: float = 20.0  # Average urban bus speed
) -> datetime:
    """Estimate when a bus will arrive at a destination"""
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
    prep_time_minutes: int = 15
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
        
        # Estimate timing
        pickup_time = estimate_bus_arrival_time(
            bus['latitude'], bus['longitude'],
            restaurant['latitude'], restaurant['longitude']
        )
        
        delivery_time = estimate_bus_arrival_time(
            restaurant['latitude'], restaurant['longitude'],
            delivery_stop['latitude'], delivery_stop['longitude']
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
    active_buses: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Assign multiple orders to available buses optimally
    
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
            active_buses
        )
        
        if best_match:
            if best_match.bus_id not in assignments:
                assignments[best_match.bus_id] = []
            
            assignments[best_match.bus_id].append({
                'order': order,
                'match': best_match
            })
    
    return assignments
