import psycopg2 
from psycopg2.extras import RealDictCursor

from core.config import(
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
)

from core.logging import logger

def get_connection():
    """
    Creates and returns a database connection
    """

    try:
        connection = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            cursor_factory=RealDictCursor,
        )

        logger.info("Database Connected Successfully")

        return connection

    except Exception as error:

        logger.exception("Failed to Connect to postgreSQL ")

        raise error

# close connection

def close_connection(connection):

    """
    Close the postgreSQL db connection
    """
    if connection:

        connection.close()

        logger.info("Database connection close")

    