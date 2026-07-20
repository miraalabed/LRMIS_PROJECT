from app.database import db


def get_kpis() -> dict:
    total = db.land_applications.count_documents({})

    pending_statuses = ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review"]
    pending  = db.land_applications.count_documents({"status": {"$in": pending_statuses}})
    approved = db.land_applications.count_documents({"status": {"$in": ["approved", "certificate_issued", "closed"]}})
    rejected = db.land_applications.count_documents({"status": "rejected"})
    under_objection = db.land_applications.count_documents({"status": "under_objection"})
    certs    = db.land_applications.count_documents({"status": {"$in": ["certificate_issued", "closed"]}})

    pipeline = [
        {"$match": {"status": "closed", "created_at": {"$exists": True}, "updated_at": {"$exists": True}}},
        {"$project": {
            "days": {
                "$divide": [
                    {"$subtract": ["$updated_at", "$created_at"]},
                    1000 * 60 * 60 * 24
                ]
            }
        }},
        {"$group": {"_id": None, "avg_days": {"$avg": "$days"}}}
    ]
    result = list(db.land_applications.aggregate(pipeline))
    avg_days = round(result[0]["avg_days"], 2) if result else None

    return {
        "total_applications": total,
        "pending_applications": pending,
        "approved_applications": approved,
        "rejected_applications": rejected,
        "applications_under_objection": under_objection,
        "certificate_issued": certs,
        "average_processing_days": avg_days,
    }



def applications_by_status() -> list:
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "status": "$_id", "count": 1}},
        {"$sort": {"count": -1}}
    ]
    return list(db.land_applications.aggregate(pipeline))



def applications_by_zone() -> list:
    pipeline = [
        {"$project": {"zone_id": {"$ifNull": ["$parcel_ref.zone_id", "$metadata.zone_id"]}}},
        {"$group": {"_id": "$zone_id", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "zone_id": {"$ifNull": ["$_id", "unknown"]}, "count": 1}},
        {"$sort": {"count": -1}}
    ]
    return list(db.land_applications.aggregate(pipeline))



def processing_time() -> list:
    pipeline = [
        {"$match": {"status": "closed"}},
        {"$project": {
            "application_type": 1,
            "days": {
                "$divide": [
                    {"$subtract": ["$updated_at", "$created_at"]},
                    1000 * 60 * 60 * 24
                ]
            }
        }},
        {"$group": {
            "_id": "$application_type",
            "avg_days": {"$avg": "$days"},
            "count": {"$sum": 1}
        }},
        {"$project": {"_id": 0, "application_type": "$_id", "avg_days": {"$round": ["$avg_days", 2]}, "count": 1}}
    ]
    return list(db.land_applications.aggregate(pipeline))



def surveyor_stats() -> list:
    pipeline = [
        {"$match": {"role": "surveyor"}},
        {"$lookup": {
            "from": "survey_tasks",
            "localField": "_id",
            "foreignField": "assigned_surveyor_id",
            "as": "tasks"
        }},
        {"$project": {
            "_id": 0,
            "surveyor_id": "$_id",
            "name": 1,
            "active_tasks": "$workload.active_tasks",
            "completed_tasks": {
                "$size": {
                    "$filter": {
                        "input": "$tasks",
                        "as": "t",
                        "cond": {"$eq": ["$$t.status", "report_uploaded"]}
                    }
                }
            }
        }}
    ]
    return list(db.staff_members.aggregate(pipeline))



def registrar_stats() -> list:
    pipeline = [
        {"$match": {"registrar_review.registrar_id": {"$exists": True}}},
        {"$group": {
            "_id": "$registrar_review.registrar_id",
            "reviewed_count": {"$sum": 1},
            "accepted_count": {
                "$sum": {"$cond": [{"$eq": ["$registrar_review.decision", "accepted"]}, 1, 0]}
            },
            "rejected_count": {
                "$sum": {"$cond": [{"$eq": ["$registrar_review.decision", "rejected"]}, 1, 0]}
            },
        }},
    ]
    results = list(db.land_applications.aggregate(pipeline))

    enriched = []
    for r in results:
        staff = db.staff_members.find_one({"_id": r["_id"]})
        enriched.append({
            "registrar_id": r["_id"],
            "name": staff.get("name") if staff else "Unknown",
            "reviewed_count": r["reviewed_count"],
            "accepted_count": r["accepted_count"],
            "rejected_count": r["rejected_count"],
        })
    return enriched
