import datetime
from sqlalchemy.orm import Session
from . import models

# --- Priority Engine ---
def calculate_priority(order: models.Order, db: Session) -> tuple[int, str, str]:
    """
    Calculates priority score (0-100), level (Low, Medium, High, Critical), and reasons.
    """
    score = 0
    reasons = []

    # 1. Delivery Urgency (Max 40 points)
    now = datetime.datetime.now()
    time_diff = order.required_delivery_date - now
    hours_left = time_diff.total_seconds() / 3600.0

    if hours_left <= 0:
        score += 40
        reasons.append("Overdue delivery deadline (+40)")
    elif hours_left <= 2:
        score += 40
        reasons.append("Delivery deadline within 2 hours (+40)")
    elif hours_left <= 6:
        score += 30
        reasons.append("Delivery deadline within 6 hours (+30)")
    elif hours_left <= 24:
        score += 20
        reasons.append("Delivery deadline within 24 hours (+20)")
    elif hours_left <= 48:
        score += 10
        reasons.append("Delivery deadline within 48 hours (+10)")
    else:
        reasons.append("Delivery deadline is relaxed (+0)")

    # 2. Customer Priority (Max 30 points)
    if order.customer_type == "VIP":
        score += 30
        reasons.append("VIP Customer priority (+30)")
    elif order.customer_type == "Premium":
        score += 20
        reasons.append("Premium Customer priority (+20)")
    else:
        score += 10
        reasons.append("Regular Customer priority (+10)")

    # 3. Order Age (Max 15 points)
    order_age_hours = (now - order.order_date).total_seconds() / 3600.0
    if order_age_hours > 24:
        score += 15
        reasons.append("Order pending over 24 hours (+15)")
    elif order_age_hours > 12:
        score += 10
        reasons.append("Order pending over 12 hours (+10)")
    elif order_age_hours > 6:
        score += 5
        reasons.append("Order pending over 6 hours (+5)")

    # 4. Order Value (Max 15 points)
    if order.order_value >= 1000:
        score += 15
        reasons.append("High order value >= $1000 (+15)")
    elif order.order_value >= 500:
        score += 10
        reasons.append("Medium-high order value >= $500 (+10)")
    elif order.order_value >= 100:
        score += 5
        reasons.append("Medium order value >= $100 (+5)")

    # Cap score at 100
    score = min(100, score)

    # Classify Priority Level
    if score >= 85:
        level = "Critical"
    elif score >= 70:
        level = "High"
    elif score >= 50:
        level = "Medium"
    else:
        level = "Low"

    reason_str = ", ".join(reasons)
    return score, level, reason_str


# --- Inventory Allocation Engine ---
def analyze_allocation_needs(db: Session):
    """
    Simulates / calculates the proposed allocation decisions.
    Does NOT write permanent changes to database order statuses unless executed,
    but analyzes current stock and returns recommended allocations.
    """
    # 1. Fetch products
    products = db.query(models.Product).all()
    stock_pool = {p.id: p.available_stock for p in products}
    product_map = {p.id: p for p in products}

    # 2. Get active orders that need allocation (status Created or waiting, and not dispatched/picked/packed)
    orders = db.query(models.Order).filter(
        models.Order.status.in_(["Created", "Allocated"])
    ).all()

    # Recalculate priority scores for sorting
    for order in orders:
        score, level, reason = calculate_priority(order, db)
        order.priority_score = score
        order.priority_level = level
        order.priority_reason = reason
    db.commit()

    # Sort orders by priority score descending
    sorted_orders = sorted(orders, key=lambda o: o.priority_score, reverse=True)

    recommendations = []
    
    # Track proposed allocations
    proposed_allocations = {} # order_id -> list of (item_id, product_id, quantity_to_allocate)
    shortages = [] # list of dicts

    for order in sorted_orders:
        order_allocations = []
        has_shortage = False
        shortage_items = []

        for item in order.items:
            product = product_map[item.product_id]
            available = stock_pool[product.id]
            required = item.quantity

            if available >= required:
                # Can fully allocate
                order_allocations.append((item.id, product.id, required))
                stock_pool[product.id] -= required
            else:
                # Partial allocation or shortage
                allocated = available
                shortage = required - allocated
                order_allocations.append((item.id, product.id, allocated))
                stock_pool[product.id] = 0
                has_shortage = True
                shortage_items.append({
                    "product_id": product.id,
                    "sku": product.sku,
                    "name": product.name,
                    "required": required,
                    "allocated": allocated,
                    "shortage": shortage
                })

        proposed_allocations[order.id] = order_allocations

        if has_shortage:
            shortages.append({
                "order_id": order.id,
                "customer": order.customer,
                "priority_level": order.priority_level,
                "priority_score": order.priority_score,
                "items": shortage_items
            })

    return proposed_allocations, shortages


def apply_allocation(db: Session, order_id: int, proposed_allocations: list):
    """
    Applies proposed allocations to an order. Updates product reserved stock,
    item allocated quantities, order status, and logs fulfillment progress.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        return

    # Check if there is any shortage in the proposed allocation
    is_fully_allocated = True
    shortage_details = []

    for item_id, product_id, qty in proposed_allocations:
        item = db.query(models.OrderItem).filter(models.OrderItem.id == item_id).first()
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not item or not product:
            continue

        # Adjust reserved stock
        diff = qty - item.allocated_quantity
        product.reserved_stock += diff
        item.allocated_quantity = qty

        if qty < item.quantity:
            is_fully_allocated = False
            shortage_details.append(f"{product.sku} ({qty}/{item.quantity})")

        # Update product status
        update_product_status(product)

    # Update Order status
    if is_fully_allocated:
        order.status = "Allocated"
        order.fulfillment_progress = 20 # Allocated stage
        # Resolve any existing Stock Shortage exceptions for this order
        active_exceptions = db.query(models.ExceptionRecord).filter(
            models.ExceptionRecord.order_id == order.id,
            models.ExceptionRecord.type == "Stock Shortage",
            models.ExceptionRecord.status == "Active"
        ).all()
        for exc in active_exceptions:
            exc.status = "Resolved"
            exc.resolution_action = "Full stock allocated after replenishment or reallocation"
    else:
        # Partially allocated
        order.status = "Created" # Remains Created but flagged
        order.fulfillment_progress = 10 # Partial allocation progress
        
        # Create or update Stock Shortage exception
        existing_exc = db.query(models.ExceptionRecord).filter(
            models.ExceptionRecord.order_id == order.id,
            models.ExceptionRecord.type == "Stock Shortage",
            models.ExceptionRecord.status == "Active"
        ).first()

        desc = f"Order #{order.id} has insufficient inventory for: {', '.join(shortage_details)}."
        rec = f"Allocate available units to Order #{order.id} due to priority {order.priority_level} and backorder the remaining units."
        
        if not existing_exc:
            exc = models.ExceptionRecord(
                order_id=order.id,
                type="Stock Shortage",
                description=desc,
                recommendation=rec,
                status="Active"
            )
            db.add(exc)
        else:
            existing_exc.description = desc
            existing_exc.recommendation = rec

    # Log the action
    log = models.FulfillmentLog(
        order_id=order.id,
        stage="Stock Allocated",
        worker="System Engine",
        exceptions_if_any="" if is_fully_allocated else "Stock Shortage"
    )
    db.add(log)
    db.commit()


def update_product_status(product: models.Product):
    """Updates product health status based on available stock and reorder level."""
    avail = product.available_stock
    if avail == 0:
        product.status = "Out of Stock"
    elif avail <= product.reorder_level * 0.5:
        product.status = "Critical"
    elif avail <= product.reorder_level:
        product.status = "Low Stock"
    else:
        product.status = "Healthy"


# --- Picking Route Optimization ---
def optimize_picking_route(locations: list[str]) -> list[str]:
    """
    Takes a list of locations (e.g. ['A2', 'B1', 'B2']) and returns them in an optimized picking order.
    Starts at (0,0) "Receiving", visits all locations, ends at (4,4) "Packing Station".
    """
    if not locations:
        return ["Receiving", "Packing Station"]

    # Parse location names to grid coordinates
    # A1 = (1,1), A2 = (1,2), A3 = (1,3)
    # B1 = (2,1), B2 = (2,2), B3 = (2,3)
    # C1 = (3,1), C2 = (3,2), C3 = (3,3)
    # Receiving = (0,0), Packing = (4,4)
    
    def loc_to_coords(loc):
        if loc == "Receiving":
            return (0, 0)
        if loc == "Packing Station":
            return (4, 4)
        
        zone = loc[0].upper()
        try:
            shelf = int(loc[1:])
        except ValueError:
            shelf = 1
            
        x = ord(zone) - ord('A') + 1 # A=1, B=2, C=3, etc.
        y = shelf
        return (x, y)

    # Perform a basic Traveling Salesperson nearest neighbor sort
    current_pos = (0, 0)
    unvisited = list(locations)
    route = []

    while unvisited:
        # Find nearest unvisited location
        nearest = None
        min_dist = float('inf')
        for loc in unvisited:
            coords = loc_to_coords(loc)
            dist = abs(current_pos[0] - coords[0]) + abs(current_pos[1] - coords[1]) # Manhattan dist
            if dist < min_dist:
                min_dist = dist
                nearest = loc
        
        route.append(nearest)
        current_pos = loc_to_coords(nearest)
        unvisited.remove(nearest)

    return ["Receiving"] + route + ["Packing Station"]


# --- Bottleneck Detection & Recommendation Engine ---
def detect_bottlenecks(db: Session) -> dict:
    """
    Scans the warehouse for delays and congestion.
    Returns: { "bottleneck_detected": True/False, "stage": str, "metric": str, "recommendation": str }
    """
    # Let's count active orders per stage
    picking_count = db.query(models.Order).filter(models.Order.status == "Picking").count()
    packing_count = db.query(models.Order).filter(models.Order.status == "Packing").count()
    qc_count = db.query(models.Order).filter(models.Order.status == "Quality Check").count()
    
    # Mock some durations/congestion percentages
    total_active = picking_count + packing_count + qc_count
    
    if total_active == 0:
        return {
            "bottleneck_detected": False,
            "stage": "None",
            "metric": "0% congestion",
            "recommendation": "Operations running smoothly. No bottlenecks detected."
        }

    picking_pct = int((picking_count / total_active) * 100) if total_active > 0 else 0
    packing_pct = int((packing_count / total_active) * 100) if total_active > 0 else 0
    qc_pct = int((qc_count / total_active) * 100) if total_active > 0 else 0

    # Determine highest congested stage
    if picking_count >= packing_count and picking_count >= qc_count and picking_count >= 2:
        return {
            "bottleneck_detected": True,
            "stage": "Picking",
            "metric": f"Picking stage contains {picking_pct}% of orders in fulfillment ({picking_count} active orders).",
            "recommendation": "Reassign an additional picker to Zone B to clear current pick tickets and resolve routing delays."
        }
    elif packing_count >= picking_count and packing_count >= qc_count and packing_count >= 2:
        return {
            "bottleneck_detected": True,
            "stage": "Packing",
            "metric": f"Packing stage contains {packing_pct}% of orders in fulfillment ({packing_count} active orders).",
            "recommendation": "Direct picker staff to assist packing stations and approve emergency carton replenishments."
        }
    elif qc_count >= picking_count and qc_count >= packing_count and qc_count >= 2:
        return {
            "bottleneck_detected": True,
            "stage": "Quality Check",
            "metric": f"Quality Check contains {qc_pct}% of orders in fulfillment ({qc_count} active orders).",
            "recommendation": "Assign an extra QA inspector to station 2 to inspect high-priority orders and speed up dispatch approvals."
        }
    
    # Default alert if it's low load but one picker is busy
    picker_util = db.query(models.Employee).filter(
        models.Employee.role == "Picker",
        models.Employee.status == "Busy"
    ).count()
    total_pickers = db.query(models.Employee).filter(models.Employee.role == "Picker").count()

    if total_pickers > 0 and (picker_util / total_pickers) >= 0.75:
         return {
            "bottleneck_detected": True,
            "stage": "Picking",
            "metric": f"{picker_util}/{total_pickers} Pickers are currently at capacity.",
            "recommendation": "Optimize picking routes and schedule a shift overlap to handle peak fulfillment load."
         }

    return {
        "bottleneck_detected": False,
        "stage": "None",
        "metric": "Balanced throughput",
        "recommendation": "System operations are running smoothly. All dispatch lanes are clear."
    }
