from typing import List, Dict, Any
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_titles: int
    total_copies: int
    available_copies: int
    checked_out_copies: int
    tagged_copies: int
    tag_coverage_percent: float
    total_members: int
    active_members: int
    blocked_members: int
    active_loans: int
    total_overdue: int
    total_unpaid_fines: float
    gate_alarms_count: int
    recent_transactions: List[Dict[str, Any]] = []
    category_distribution: List[Dict[str, Any]] = []
    shelf_distribution: List[Dict[str, Any]] = []
