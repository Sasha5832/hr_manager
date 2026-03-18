

import django .db .models .deletion 
from django .db import migrations ,models 


class Migration (migrations .Migration ):

    dependencies =[
    ('core','0002_alter_leaverequest_options_and_more'),
    ]

    operations =[
    migrations .CreateModel (
    name ='AttendanceRecord',
    fields =[
    ('id',models .BigAutoField (auto_created =True ,primary_key =True ,serialize =False ,verbose_name ='ID')),
    ('date',models .DateField ()),
    ('status',models .CharField (choices =[('present','Obecny'),('remote','Zdalnie'),('sick','Chorobowe'),('vacation','Urlop'),('absent','Nieobecny')],default ='present',max_length =16 )),
    ('minutes_worked',models .PositiveIntegerField (default =0 ,help_text ='Łączna liczba minut pracy w tym dniu')),
    ('notes',models .CharField (blank =True ,max_length =255 )),
    ('employee',models .ForeignKey (on_delete =django .db .models .deletion .CASCADE ,to ='core.employee')),
    ],
    options ={
    'ordering':['-date','-id'],
    'indexes':[models .Index (fields =['employee','date'],name ='core_attend_employe_acf142_idx'),models .Index (fields =['status'],name ='core_attend_status_b09f21_idx')],
    'unique_together':{('employee','date')},
    },
    ),
    ]
