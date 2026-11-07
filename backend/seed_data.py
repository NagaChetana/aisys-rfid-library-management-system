from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.catalog import Author, Category, Book, BookItem
from app.models.member import Member
from app.models.setting import SystemSetting
from app.models.audit import AuditLog

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        if db.query(Role).count() > 0:
            print("Database already seeded with core records.")
            return

        print("Seeding initial database...")

        # 1. System Settings
        settings_data = [
            ("max_fine_limit", "15.00", "circulation", "Maximum unpaid fine balance permitted before loan blocking"),
            ("loan_period_days", "14", "circulation", "Standard borrowing period in days"),
            ("grace_period_days", "1", "circulation", "Grace period in days before overdue fines begin accrual"),
            ("daily_overdue_fine", "0.50", "circulation", "Daily penalty fee for overdue items in dollars"),
            ("duplicate_event_window_ms", "3000", "rfid", "Sliding window filter to suppress duplicate RFID reader events")
        ]
        for key, val, cat, desc in settings_data:
            db.add(SystemSetting(key=key, value=val, category=cat, description=desc))

        # 2. Roles
        roles = {
            "ADMIN": Role(name="ADMIN", description="System Administrator", permissions="ALL"),
            "LIBRARIAN": Role(name="LIBRARIAN", description="Chief Librarian", permissions="CATALOG,CIRCULATION,REPORTS,MEMBERS"),
            "STAFF": Role(name="STAFF", description="Circulation Desk Staff", permissions="CIRCULATION,INVENTORY,GATE"),
            "PATRON": Role(name="PATRON", description="Registered Library Patron", permissions="OPAC,VIEW_LOANS")
        }
        for r in roles.values():
            db.add(r)
        db.flush()

        # 3. Users (with smart card badges for AC07)
        users = [
            User(
                username="admin",
                email="admin@library.aisys.local",
                password_hash=get_password_hash("admin123"),
                role_id=roles["ADMIN"].id,
                smart_card_uid="SC-ADMIN-001",
                full_name="Sarah Connor (System Admin)",
                is_active=True
            ),
            User(
                username="librarian",
                email="librarian@library.aisys.local",
                password_hash=get_password_hash("lib123"),
                role_id=roles["LIBRARIAN"].id,
                smart_card_uid="SC-LIB-002",
                full_name="John Doe (Senior Librarian)",
                is_active=True
            ),
            User(
                username="staff",
                email="staff@library.aisys.local",
                password_hash=get_password_hash("staff123"),
                role_id=roles["STAFF"].id,
                smart_card_uid="SC-STAFF-003",
                full_name="Emma Watson (Desk Officer)",
                is_active=True
            )
        ]
        for u in users:
            db.add(u)
        db.flush()

        # 4. Categories (Dewey Decimal Classification)
        categories = [
            Category(code="004", name="Computer Science & Artificial Intelligence", dewey_range="000-099"),
            Category(code="100", name="Philosophy & Cognitive Psychology", dewey_range="100-199"),
            Category(code="300", name="Social Sciences & Economics", dewey_range="300-399"),
            Category(code="500", name="Natural Sciences & Pure Mathematics", dewey_range="500-599"),
            Category(code="620", name="Applied Engineering & Embedded Systems", dewey_range="600-699"),
            Category(code="800", name="Literature & Classic Rhetoric", dewey_range="800-899")
        ]
        for c in categories:
            db.add(c)
        db.flush()

        # 5. Authors
        authors = [
            Author(name="Stuart Russell & Peter Norvig", biography="Pioneers in artificial intelligence research and modern agent architectures."),
            Author(name="Donald E. Knuth", biography="Professor Emeritus at Stanford University, author of The Art of Computer Programming."),
            Author(name="Martin Fowler", biography="Chief Scientist at Thoughtworks, expert in enterprise software architecture."),
            Author(name="Robert C. Martin (Uncle Bob)", biography="Author of Clean Architecture and Clean Code, co-author of Agile Manifesto."),
            Author(name="Andrew S. Tanenbaum", biography="Professor of Computer Science, author of MINIX and distributed systems texts.")
        ]
        for a in authors:
            db.add(a)
        db.flush()

        # 6. Books & Physical Copies (BookItems)
        catalog_seed = [
            {
                "isbn": "978-0134610993",
                "title": "Artificial Intelligence: A Modern Approach",
                "subtitle": "Global Edition (4th Edition)",
                "author": authors[0],
                "category": categories[0],
                "publisher": "Pearson",
                "publish_year": 2020,
                "call_number": "004.RUS.2020",
                "copies": [
                    {"acc": "ACC-000001", "bc": "BC00000001", "shelf": "AI-SHELF-01", "ref": True},  # Reference copy!
                    {"acc": "ACC-000002", "bc": "BC00000002", "shelf": "AI-SHELF-01", "ref": False},
                    {"acc": "ACC-000003", "bc": "BC00000003", "shelf": "AI-SHELF-01", "ref": False}
                ]
            },
            {
                "isbn": "978-0201896831",
                "title": "The Art of Computer Programming, Volume 1",
                "subtitle": "Fundamental Algorithms",
                "author": authors[1],
                "category": categories[0],
                "publisher": "Addison-Wesley",
                "publish_year": 1997,
                "call_number": "004.KNU.V1",
                "copies": [
                    {"acc": "ACC-000004", "bc": "BC00000004", "shelf": "CS-SHELF-02", "ref": True},  # Reference copy!
                    {"acc": "ACC-000005", "bc": "BC00000005", "shelf": "CS-SHELF-02", "ref": False}
                ]
            },
            {
                "isbn": "978-0134494166",
                "title": "Clean Architecture: A Craftsman's Guide to Software Structure",
                "subtitle": "Robert C. Martin Series",
                "author": authors[3],
                "category": categories[4],
                "publisher": "Prentice Hall",
                "publish_year": 2017,
                "call_number": "620.MAR.2017",
                "copies": [
                    {"acc": "ACC-000006", "bc": "BC00000006", "shelf": "ENG-SHELF-03", "ref": False},
                    {"acc": "ACC-000007", "bc": "BC00000007", "shelf": "ENG-SHELF-03", "ref": False}
                ]
            },
            {
                "isbn": "978-0134757599",
                "title": "Refactoring: Improving the Design of Existing Code",
                "subtitle": "2nd Edition",
                "author": authors[2],
                "category": categories[4],
                "publisher": "Addison-Wesley",
                "publish_year": 2018,
                "call_number": "620.FOW.2018",
                "copies": [
                    {"acc": "ACC-000008", "bc": "BC00000008", "shelf": "ENG-SHELF-03", "ref": False},
                    {"acc": "ACC-000009", "bc": "BC00000009", "shelf": "ENG-SHELF-03", "ref": False}
                ]
            },
            {
                "isbn": "978-0133591620",
                "title": "Modern Operating Systems",
                "subtitle": "4th Edition",
                "author": authors[4],
                "category": categories[0],
                "publisher": "Pearson",
                "publish_year": 2014,
                "call_number": "004.TAN.2014",
                "copies": [
                    {"acc": "ACC-000010", "bc": "BC00000010", "shelf": "CS-SHELF-02", "ref": False},
                    {"acc": "ACC-000011", "bc": "BC00000011", "shelf": "CS-SHELF-02", "ref": False}
                ]
            }
        ]

        for b_data in catalog_seed:
            book = Book(
                isbn=b_data["isbn"],
                title=b_data["title"],
                subtitle=b_data["subtitle"],
                author_id=b_data["author"].id,
                category_id=b_data["category"].id,
                publisher=b_data["publisher"],
                publish_year=b_data["publish_year"],
                call_number=b_data["call_number"]
            )
            db.add(book)
            db.flush()

            for i, c in enumerate(b_data["copies"], 1):
                item = BookItem(
                    book_id=book.id,
                    accession_number=c["acc"],
                    barcode=c["bc"],
                    copy_number=i,
                    shelf_location=c["shelf"],
                    status="available",
                    is_reference_only=c["ref"],
                    price=49.99
                )
                db.add(item)
        db.flush()

        # 7. Members (designed for testing AC04 circulation restrictions)
        members_seed = [
            Member(
                membership_number="MEM-00001",
                full_name="Alice Smith",
                email="alice.smith@university.edu",
                phone="+1-555-0101",
                smart_card_uid="CARD-ALICE-1001",
                status="active",
                fine_balance=0.00,
                max_allowed_loans=5,
                membership_type="student",
                expiry_date=date(2027, 6, 30)
            ),
            Member(
                membership_number="MEM-00002",
                full_name="Bob Jones (Blocked Patron)",
                email="bob.jones@university.edu",
                phone="+1-555-0102",
                smart_card_uid="CARD-BOB-1002",
                status="blocked",  # For testing AC04 blocked member!
                fine_balance=25.00,
                max_allowed_loans=5,
                membership_type="student",
                expiry_date=date(2027, 6, 30)
            ),
            Member(
                membership_number="MEM-00003",
                full_name="Charlie Brown (Over Fine Limit)",
                email="charlie.brown@university.edu",
                phone="+1-555-0103",
                smart_card_uid="CARD-CHARLIE-1003",
                status="active",
                fine_balance=18.50,  # Exceeds $15.00 limit for testing AC04!
                max_allowed_loans=5,
                membership_type="student",
                expiry_date=date(2027, 6, 30)
            ),
            Member(
                membership_number="MEM-00004",
                full_name="Diana Prince (Faculty)",
                email="diana.prince@university.edu",
                phone="+1-555-0104",
                smart_card_uid="CARD-DIANA-1004",
                status="active",
                fine_balance=0.00,
                max_allowed_loans=10,
                membership_type="faculty",
                expiry_date=date(2028, 12, 31)
            )
        ]
        for m in members_seed:
            db.add(m)

        # 8. Initial Audit Log
        db.add(AuditLog(
            action="SYSTEM_INITIALIZED",
            resource_type="system",
            details="System seed data populated successfully according to AISYS SOP.",
            ip_address="127.0.0.1"
        ))

        db.commit()
        print("Database successfully seeded with synthetic sample dataset.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
