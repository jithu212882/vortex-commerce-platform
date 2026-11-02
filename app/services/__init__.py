from app.services.recommender import recommender_service
from app.services.vision_service import vision_service
from app.services.agent_workflow import agent_workflow_service

# Convenient alias
support_workflow = agent_workflow_service

__all__ = [
    "recommender_service",
    "vision_service",
    "agent_workflow_service",
    "support_workflow",
]
