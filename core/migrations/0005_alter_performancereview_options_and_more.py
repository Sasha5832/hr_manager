

from django .db import migrations 


class Migration (migrations .Migration ):

    dependencies =[
    ('core','0004_quarter_to_month'),
    ]

    operations =[
    migrations .AlterModelOptions (
    name ='performancereview',
    options ={'ordering':['-year','-month','-id']},
    ),
    migrations .RenameIndex (
    model_name ='performancereview',
    new_name ='core_perfor_employe_3f59ef_idx',
    old_name ='core_perf_emp_year_month_idx',
    ),
    ]
