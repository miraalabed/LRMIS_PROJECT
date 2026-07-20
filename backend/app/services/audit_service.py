from datetime import datetime, timezone
from app.database import db


def log_event(event_type: str, application_id: str = None, user_id: str = None, details: dict = None):
	entry = {
		"event_type": event_type,
		"application_id": application_id,
		"user_id": user_id,
		"details": details or {},
		"timestamp": datetime.now(timezone.utc),
	}
	db.performance_logs.insert_one(entry)
	return entry

