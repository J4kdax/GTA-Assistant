/* Explorer — traduction anglaise du dictionnaire des types de règle (RULE_TYPE_DOC).
 * Même clés que 02-constantes.js ; un type absent ici retombe sur le français. */
"use strict";

const RULE_TYPE_DOC_EN = {
 "_001_STD_GTA_Count_Hours": {
  "title": "Hour count",
  "desc": "Counts the hours worked on the listed day types, within a time window (Day start / Day end), with a Value max cap and several modes (actual hours, days, thresholds)."
 },
 "_010_STD_GTA_Count_Weekly_Hours": {
  "title": "Weekly count",
  "desc": "Counts weekly hours between two bounds (Count from x weekly hours / Count to). Used for overtime or weekly thresholds."
 },
 "_015_STD_GTA_Count_Hours_On_Time_Range": {
  "title": "Count over a time range",
  "desc": "Counts hours only within a specific time range of the day (Time range start / end). Useful for Sunday-evening or night premiums."
 },
 "_017_STD_GTA_Count_Shifts_Per_Task": {
  "title": "Shift count per task",
  "desc": "Counts the number of shifts assigned to one or more given tasks."
 },
 "_018_STD_GTA_Count_Breaks": {
  "title": "Break count",
  "desc": "Counts breaks meeting a duration threshold (between Break duration min and max)."
 },
 "_028_STD_GTA_Constant_end_contract": {
  "title": "End-of-contract constant",
  "desc": "Assigns a constant value at the end of the contract, possibly pro-rated."
 },
 "_031_STD_GTA_Sum_rule_per_month_week": {
  "title": "Rule total per month or week",
  "desc": "Adds up the value of a source rule over a time aggregate (Sum per: month / week)."
 },
 "_037_STD_GTA_Additionnal_hours_end_contract_period": {
  "title": "Overtime at end of period",
  "desc": "Calculates overtime by comparing the “hours worked” counter with the “annual credit”, between a starting (Coef from) and an ending (Coef to) coefficient."
 },
 "_039_STD_GTA_Formula": {
  "title": "Calculation formula (per day)",
  "desc": "Free formula evaluated ONCE per day. References: ruleN (value of another rule that day), htimeN (hours on shifts whose idTypeAbsence=N — htime0 for standard shifts), rateN, fieldN, weekDay, day, month, etc. Syntax: if(cond|then||else), operators + - * / = < > <= >= != and or, functions ceil floor round min max intdiv in_array. Brackets are required around or/and inside an if."
 },
 "_040_STD_GTA_Special_days": {
  "title": "Special days",
  "desc": "Identifies special days (public holidays, exceptional days) from a transcoding table."
 },
 "_042_STD_GTA_Bank_holiday_worked": {
  "title": "Public holiday worked",
  "desc": "Counts the hours worked on a public holiday (Spacial day type)."
 },
 "_057_STD_GTA_Manual_Bonus": {
  "title": "Manual bonus",
  "desc": "Bonus entered manually, not calculated automatically. Code and label are passed on as they are."
 },
 "_060_STD_GTA_Daily_non_rest_hours": {
  "title": "Hours breaching daily rest",
  "desc": "Counts the hours that do not respect the daily rest period (Count from / to x hours of rest)."
 },
 "_069_STD_GTA_Night_hours": {
  "title": "Night hours",
  "desc": "Counts the hours worked within the night range (Day start time → Night end time)."
 },
 "_076_STD_GTA_Month_prorata_working_days_with_coef": {
  "title": "Monthly pro rata (working days)",
  "desc": "Pro-rates a monthly value over working days, with a coefficient."
 },
 "_081_STD_GTA_Panier_bonus_without_break": {
  "title": "Meal allowance (no break condition)",
  "desc": "Grants a meal allowance when the shift length meets a threshold, regardless of breaks."
 },
 "_088_STD_GTA_Ticket_restaurant_with_break": {
  "title": "Meal voucher (break required)",
  "desc": "Grants a meal voucher when a minimum break is taken (Break between, Break duration more than)."
 },
 "_116_STD_COB_Count_Hours": {
  "title": "Hour count (Cobalt)",
  "desc": "Cobalt variant of the hour count — settings close to _001 but on a Cobalt scope (fees, intermittent staff)."
 },
 "_123_STD_COB_Nb_shifts_per_period": {
  "title": "Shifts per period (Cobalt)",
  "desc": "Counts the number of shifts (fees) over a given period."
 },
 "_124_STD_IND_Total_Rule": {
  "title": "Rule total (Allowances)",
  "desc": "Adds up the value of a source rule over the whole period. Used for allowance counters."
 },
 "_125_STD_IND_Worked_hours": {
  "title": "Hours worked (Allowances)",
  "desc": "Aggregates the hours worked over the period (Allowances module)."
 },
 "_140_STD_GTA_Month_prorata_30th": {
  "title": "Monthly pro rata, 30ths",
  "desc": "Pro-rates a monthly value on a 30ths basis (calendar days)."
 },
 "_160_STD_GTA_cycledate": {
  "title": "Cycle date",
  "desc": "Determines the cycle date used to calculate cyclical hours."
 },
 "_162_STD_IND_totalCycle": {
  "title": "Cycle total (Allowances)",
  "desc": "Adds up the value of a source rule over the whole cycle (Allowances module)."
 },
 "_005_STD_GTA_Count_Shift_Per_Day_Types": {
  "title": "Shift count per day type",
  "desc": "Counts the shifts covering the listed day types."
 },
 "_016_STD_GTA_Count_Shifts": {
  "title": "Shift count",
  "desc": "Counts the eligible shifts within the scope (venues, tasks, roles, day types)."
 },
 "_019_STD_GTA_Count_Days_Worked": {
  "title": "Days worked count",
  "desc": "Counts the days worked over the period (unlike _001, which counts hours)."
 },
 "_020_STD_GTA_Count_1_between_two_dates": {
  "title": "Constant 1 between two dates",
  "desc": "Assigns the value 1 to each day between a start and an end date (From / To)."
 },
 "_021_STD_GTA_Constant_per_month": {
  "title": "Monthly constant",
  "desc": "Assigns a constant value every month (regular payment such as a bonus)."
 },
 "_025_STD_GTA_Constant_per_day": {
  "title": "Daily constant",
  "desc": "Assigns a constant value per eligible day (by day type, time window, weekday)."
 },
 "_026_STD_GTA_Constant_per_day_2": {
  "title": "Daily constant (variant)",
  "desc": "Variant of _025 with different settings — often used for specific allowances."
 },
 "_027_STD_GTA_Combine_rules": {
  "title": "Rule combination",
  "desc": "Combines the value of several source rules (Rules to add up) with a coefficient."
 },
 "_029_STD_GTA_End_contract_compensation": {
  "title": "End-of-contract compensation",
  "desc": "Compensation paid at the end of the contract, calculated from a source rule and a coefficient."
 },
 "_030_STD_GTA_Sum_values_by_day_over_the_week": {
  "title": "Daily sum over the week",
  "desc": "Day-by-day sum over the week, shown on the last day of the week or on a fixed day."
 },
 "_032_STD_GTA_Sum_rule_per_month_week_per_contact": {
  "title": "Total per month or week, per contact",
  "desc": "Variant of _031 that aggregates the source rule per contact (per employee) over a period."
 },
 "_033_STD_GTA_Sum_rule_total_per_contract_or_period": {
  "title": "Total per contract or period",
  "desc": "Adds up a source rule either over the contract duration or over a fixed period."
 },
 "_035_STD_GTA_Count_weekly_hours_depending_on_day": {
  "title": "Weekly count by weekday",
  "desc": "Counts weekly hours, weighted by day of the week."
 },
 "_046_STD_GTA_Constant_Bank_holiday_worked": {
  "title": "Public holiday worked constant",
  "desc": "Assigns a constant value when a public holiday is worked."
 },
 "_047_AIX_GTA_Heures_jours_feries_intermittents": {
  "title": "Public holiday hours, intermittent staff (AIX)",
  "desc": "Festival d'Aix specific: hours worked on public holidays by intermittent staff."
 },
 "_056_STD_GTA_Count_hours_day_on_dates": {
  "title": "Hours on specific dates",
  "desc": "Counts the hours worked on a list of calendar dates (e.g. public holidays that are worked)."
 },
 "_058_STD_GTA_Empty_rule": {
  "title": "Empty rule",
  "desc": "Placeholder rule. No actual calculation."
 },
 "_059_STD_GTA_Credit_counter": {
  "title": "Credit counter",
  "desc": "Counter tracking a credit (hours, days, allowances) accrued and debited over time."
 },
 "_062_STD_GTA_Daily_non_rest_hours_2": {
  "title": "Hours breaching daily rest (variant)",
  "desc": "Variant of _060 — hours that do not respect the daily rest period, with a different logic."
 },
 "_070_STD_GTA_Constant_hours_worked_time_range": {
  "title": "Constant for hours worked in a range",
  "desc": "Assigns a constant when hours are worked within a given time range."
 },
 "_075_STD_GTA_Month_prorata": {
  "title": "Monthly pro rata",
  "desc": "Pro-rates a value over the days of the month (simpler than _076, which weights working days)."
 },
 "_078_STD_GTA_Panier_bonus": {
  "title": "Meal allowance",
  "desc": "Grants a meal allowance depending on shift length and time range."
 },
 "_087_STD_GTA_Ticket_restaurant": {
  "title": "Meal voucher",
  "desc": "Grants a meal voucher based on days worked (no specific break condition)."
 },
 "_092_AIX_GTA_Indemnite_transport_7_zones": {
  "title": "Travel allowance, 7 zones (AIX)",
  "desc": "Festival d'Aix specific: travel allowance by home zone (A to G)."
 },
 "_093_STD_GTA_Month_prorata_3": {
  "title": "Monthly pro rata (variant 3)",
  "desc": "Monthly pro rata variant, configured for a particular case."
 },
 "_095_AIX_GTA_Indemnites_logement": {
  "title": "Housing allowance (AIX)",
  "desc": "Housing allowance specific to the Festival d'Aix."
 },
 "_096_AIX_GTA_Indemnites_logement_anticipees": {
  "title": "Advance housing allowance (AIX)",
  "desc": "Housing allowance paid in advance, specific to the Festival d'Aix."
 },
 "_097_AIX_GTA_Variables_module_auto": {
  "title": "Auto module variables (AIX)",
  "desc": "Dynamic variables module specific to the Festival d'Aix."
 },
 "_098_STD_GTA_Full_week": {
  "title": "Full week",
  "desc": "Detects whether the week is fully worked according to given criteria."
 },
 "_099_STD_GTA_Source_rule_divided_by_nb_month_days": {
  "title": "Source rule divided by days in month",
  "desc": "Divides the value of a source rule by the number of days in the month (reverse pro rata)."
 },
 "_104_STD_GTA_Annual_leave_acquisition": {
  "title": "Annual leave accrual",
  "desc": "Calculates paid leave accrual (days accrued per full month, minimum attendance, public holidays)."
 },
 "_106_STD_GTA_Combine_rule_time_range": {
  "title": "Rule combination over a time range",
  "desc": "Combines several rules, restricted to a time range of the day."
 },
 "_122_STD_COB_Xth_daily_activity_type": {
  "title": "Xth activity of the day (Cobalt)",
  "desc": "Identifies the Xth activity (fee) of the day among the listed types. Cobalt / fees module."
 },
 "_126_STD_IND_Suivi_modulation": {
  "title": "Modulation tracking (Allowances)",
  "desc": "Modulation tracking counter on the Allowances side (hours actually carried over)."
 },
 "_133_AIX_IND_Suivi_modulation": {
  "title": "Modulation tracking (AIX, Allowances)",
  "desc": "Festival d'Aix variant of modulation tracking on the Allowances side."
 },
 "_142_STD_GTA_Source_rule_value_other_day": {
  "title": "Source rule value on another day",
  "desc": "Reads the value of a source rule for an offset day (Day(s) before/after)."
 },
 "_143_STD_COB_FormulaRoles": {
  "title": "Formula per role (Cobalt)",
  "desc": "Free Cobalt formula calculated per role (e.g. tauxInstSupp1+tauxInstSupp2)."
 },
 "_163_STD_GTA_SBSFormula": {
  "title": "SBS formula (per shift)",
  "desc": "Formula evaluated separately for EACH shift of the day, then summed automatically. Shift variables: idtask, idactivitytype, idvenue, idproductiontype, starttime/endtime (decimal hours), htimeN/mtimeN (shift length in hours/minutes, defined only when idTypeAbsence=N for that shift — htime0 for a standard shift). Day variables as in _039: weekDay, day, ruleN, rate, field, etc. More powerful than _039 for per-activity calculations (filtering by task, range, venue)."
 },
 "_165_STD_GTA_Source_rule_total_period": {
  "title": "Source rule total over the period",
  "desc": "Adds up the value of a source rule over the whole contract period."
 },
 "_xxx_AixIndemniteTransport": {
  "title": "Travel allowance (AIX, ad hoc)",
  "desc": "Ad hoc travel allowance specific to the Festival d'Aix (non-standard prefix)."
 }
};
