def is_valid_geojson(obj: dict) -> bool:
	if not isinstance(obj, dict):
		return False
	if "type" not in obj or "coordinates" not in obj:
		return False
	t = obj.get("type")
	return t in ("Point", "Polygon", "MultiPolygon", "LineString", "MultiLineString")

