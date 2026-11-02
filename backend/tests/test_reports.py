from app.modules.reports import repository


def test_report_list_orders_by_generated_at():
    class Query:
        def order_by(self, clause):
            assert str(clause) == "reports.generated_at DESC"
            return self

        def offset(self, value):
            assert value == 5
            return self

        def limit(self, value):
            assert value == 10
            return self

        def all(self):
            return []

    class Session:
        def query(self, model):
            assert model is repository.Report
            return Query()

    assert repository.get_reports(Session(), skip=5, limit=10) == []
