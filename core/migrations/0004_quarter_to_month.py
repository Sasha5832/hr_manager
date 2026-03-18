from django .db import migrations ,models 
from django .db .models import Q ,F 


def map_period_to_month (apps ,schema_editor ):
    """
    Przepisuje istniejące oceny: period(Q1..Q4) -> month(1..12).
    Mapa: Q1->3, Q2->6, Q3->9, Q4->12 (środek kwartału).
    """
    PerformanceReview =apps .get_model ("core","PerformanceReview")
    mapping ={"Q1":3 ,"Q2":6 ,"Q3":9 ,"Q4":12 }

    for pr in PerformanceReview .objects .all ():
        period =getattr (pr ,"period",None )
        pr .month =mapping .get (period ,1 )
        pr .save (update_fields =["month"])


class Migration (migrations .Migration ):

    dependencies =[
    ("core","0003_attendancerecord"),
    ]

    operations =[

    migrations .RemoveConstraint (
    model_name ="performancereview",
    name ="uniq_employee_period_year",
    ),
    migrations .RemoveIndex (
    model_name ="performancereview",
    name ="core_perfor_employe_28483a_idx",
    ),


    migrations .AddField (
    model_name ="performancereview",
    name ="month",
    field =models .PositiveSmallIntegerField (null =True ),
    ),


    migrations .RunPython (map_period_to_month ,migrations .RunPython .noop ),


    migrations .AlterField (
    model_name ="performancereview",
    name ="month",
    field =models .PositiveSmallIntegerField (),
    ),


    migrations .RemoveField (
    model_name ="performancereview",
    name ="period",
    ),


    migrations .AddIndex (
    model_name ="performancereview",
    index =models .Index (
    fields =["employee","year","month"],
    name ="core_perf_emp_year_month_idx",
    ),
    ),
    migrations .AddConstraint (
    model_name ="performancereview",
    constraint =models .UniqueConstraint (
    fields =["employee","year","month"],
    name ="uniq_employee_year_month",
    ),
    ),
    migrations .AddConstraint (
    model_name ="performancereview",
    constraint =models .CheckConstraint (
    condition =Q (month__gte =1 )&Q (month__lte =12 ),
    name ="month_between_1_12",
    ),
    ),
    migrations .AddConstraint (
    model_name ="performancereview",
    constraint =models .CheckConstraint (
    condition =Q (absent_days__lte =F ("working_days")),
    name ="absent_le_working",
    ),
    ),
    ]
