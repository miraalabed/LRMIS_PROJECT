from app.database import db


def get_parcels_geojson(zone: str | None = None, status: str | None = None) -> dict:
   
    query = {"parcel_geojson": {"$exists": True, "$ne": None}}
    if zone:
        query["$or"] = [{"parcel_ref.zone_id": zone}, {"metadata.zone_id": zone}]
    if status:
        query["status"] = status

    features = []
    for app in db.land_applications.find(query):
        geometry = app.get("parcel_geojson")
        if not geometry:
            continue

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "application_id": app.get("_id"),
                "parcel_id":       app.get("parcel_id"),
                "status":          app.get("status"),
                "application_type": app.get("application_type"),
                "zone_id":         app.get("parcel_ref", {}).get("zone_id") or app.get("metadata", {}).get("zone_id"),
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def get_pending_heatmap() -> dict:
    
    pending_statuses = [
        "submitted", "pre_checked", "survey_required",
        "surveyed", "legal_review", "under_objection"
    ]

    query = {
        "status": {"$in": pending_statuses},
        "parcel_geojson": {"$exists": True, "$ne": None}
    }

    features = []
    for app in db.land_applications.find(query):
        geometry = app.get("parcel_geojson")
        if not geometry:
            continue

        coords = _extract_coords(geometry)
        if not coords:
            continue

        lng_avg = sum(c[0] for c in coords) / len(coords)
        lat_avg = sum(c[1] for c in coords) / len(coords)

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng_avg, lat_avg]},
            "properties": {
                "application_id": app.get("_id"),
                "status": app.get("status"),
                "weight": 1
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def _extract_coords(geometry: dict) -> list:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates", [])

    if gtype == "Polygon":
        return coords[0] if coords else []

    if gtype == "Point":
        return [coords]

    return []
