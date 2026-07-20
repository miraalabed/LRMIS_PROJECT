from bson import ObjectId


class PydanticObjectId(ObjectId):
	@classmethod
	def __get_validators__(cls):
		yield cls.validate

	@classmethod
	def validate(cls, v):
		if isinstance(v, ObjectId):
			return v
		try:
			return ObjectId(str(v))
		except Exception:
			raise ValueError("Invalid ObjectId")


def oid_str(oid):
	return str(oid) if oid is not None else None

