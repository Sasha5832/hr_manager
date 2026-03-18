

import core .models 
from django .db import migrations ,models 


class Migration (migrations .Migration ):

    dependencies =[
    ('core','0001_initial'),
    ]

    operations =[
    migrations .AlterModelOptions (
    name ='leaverequest',
    options ={'ordering':['-created_at','-id']},
    ),
    migrations .AlterModelOptions (
    name ='performancereview',
    options ={'ordering':['-year','period','-id']},
    ),
    migrations .AlterUniqueTogether (
    name ='performancereview',
    unique_together =set (),
    ),
    migrations .AlterField (
    model_name ='performancereview',
    name ='year',
    field =models .PositiveIntegerField (default =core .models .current_year ),
    ),
    migrations .AddIndex (
    model_name ='leaverequest',
    index =models .Index (fields =['employee','start_date'],name ='core_leaver_employe_70c496_idx'),
    ),
    migrations .AddIndex (
    model_name ='leaverequest',
    index =models .Index (fields =['employee','end_date'],name ='core_leaver_employe_85da15_idx'),
    ),
    migrations .AddIndex (
    model_name ='leaverequest',
    index =models .Index (fields =['status'],name ='core_leaver_status_8e7625_idx'),
    ),
    migrations .AddIndex (
    model_name ='performancereview',
    index =models .Index (fields =['employee','year','period'],name ='core_perfor_employe_28483a_idx'),
    ),
    migrations .AddConstraint (
    model_name ='leaverequest',
    constraint =models .CheckConstraint (condition =models .Q (('end_date__gte',models .F ('start_date'))),name ='leave_dates_order'),
    ),
    migrations .AddConstraint (
    model_name ='performancereview',
    constraint =models .UniqueConstraint (fields =('employee','period','year'),name ='uniq_employee_period_year'),
    ),
    migrations .AddConstraint (
    model_name ='performancereview',
    constraint =models .CheckConstraint (condition =models .Q (('absent_days__lte',models .F ('working_days'))),name ='absent_le_working'),
    ),
    ]
