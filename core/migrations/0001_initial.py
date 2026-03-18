

import django .db .models .deletion 
from django .conf import settings 
from django .db import migrations ,models 


class Migration (migrations .Migration ):

    initial =True 

    dependencies =[
    migrations .swappable_dependency (settings .AUTH_USER_MODEL ),
    ]

    operations =[
    migrations .CreateModel (
    name ='Employee',
    fields =[
    ('id',models .BigAutoField (auto_created =True ,primary_key =True ,serialize =False ,verbose_name ='ID')),
    ('phone_number',models .CharField (max_length =20 )),
    ('position',models .CharField (max_length =50 )),
    ('hire_date',models .DateField ()),
    ('user',models .OneToOneField (on_delete =django .db .models .deletion .CASCADE ,to =settings .AUTH_USER_MODEL )),
    ],
    ),
    migrations .CreateModel (
    name ='LeaveRequest',
    fields =[
    ('id',models .BigAutoField (auto_created =True ,primary_key =True ,serialize =False ,verbose_name ='ID')),
    ('start_date',models .DateField ()),
    ('end_date',models .DateField ()),
    ('reason',models .TextField (blank =True )),
    ('status',models .CharField (choices =[('pending','Oczekuje'),('approved','Zaakceptowany'),('rejected','Odrzucony')],default ='pending',max_length =10 )),
    ('created_at',models .DateTimeField (auto_now_add =True )),
    ('employee',models .ForeignKey (on_delete =django .db .models .deletion .CASCADE ,to ='core.employee')),
    ],
    ),
    migrations .CreateModel (
    name ='PerformanceReview',
    fields =[
    ('id',models .BigAutoField (auto_created =True ,primary_key =True ,serialize =False ,verbose_name ='ID')),
    ('period',models .CharField (choices =[('Q1','Q1'),('Q2','Q2'),('Q3','Q3'),('Q4','Q4')],max_length =2 )),
    ('year',models .PositiveIntegerField (default =2025 )),
    ('working_days',models .PositiveIntegerField ()),
    ('absent_days',models .PositiveIntegerField ()),
    ('comments',models .TextField (blank =True )),
    ('employee',models .ForeignKey (on_delete =django .db .models .deletion .CASCADE ,to ='core.employee')),
    ],
    options ={
    'unique_together':{('employee','period','year')},
    },
    ),
    ]
