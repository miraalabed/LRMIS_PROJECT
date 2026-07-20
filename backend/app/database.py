import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "lrmis_db")


def get_database():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
    except PyMongoError as exc:
        raise RuntimeError(
            f"Could not connect to MongoDB at {MONGO_URL}. "
            "Start MongoDB and verify the connection string."
        ) from exc

    print(f"Connected to MongoDB database: {DATABASE_NAME}")
    return client[DATABASE_NAME]


db = get_database()
