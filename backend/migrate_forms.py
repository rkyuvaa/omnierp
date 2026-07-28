import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Path to .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def run_migration():
    queries = [
        """
        CREATE TABLE IF NOT EXISTS form_definitions (
            id SERIAL PRIMARY KEY,
            module VARCHAR(50),
            name VARCHAR(100),
            prefix_template VARCHAR(50) DEFAULT '',
            suffix_template VARCHAR(50) DEFAULT '',
            reset_cycle VARCHAR(20) DEFAULT 'none',
            last_number INTEGER DEFAULT 0,
            last_reset_date TIMESTAMP,
            fields_config JSON DEFAULT '[]',
            mapping_config JSON DEFAULT '{}',
            pdf_config JSON DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS form_submissions (
            id SERIAL PRIMARY KEY,
            form_definition_id INTEGER REFERENCES form_definitions(id),
            parent_id INTEGER,
            reference_number VARCHAR(100) UNIQUE,
            data JSON DEFAULT '{}',
            status VARCHAR(20) DEFAULT 'draft',
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    ]
    
    # Simple check for SQLite
    if not DATABASE_URL.startswith("postgresql"):
        # Convert SERIAL to INTEGER PRIMARY KEY AUTOINCREMENT
        queries = [q.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
                   .replace("JSON DEFAULT '[]'", "JSON DEFAULT '[]'")
                   .replace("JSON DEFAULT '{}'", "JSON DEFAULT '{}'")
                   for q in queries]

    with engine.connect() as conn:
        for q in queries:
            try:
                conn.execute(text(q))
                conn.commit()
                print(f"Executed: {q[:50]}...")
            except Exception as e:
                print(f"Error executing: {e}")

if __name__ == "__main__":
    run_migration()
