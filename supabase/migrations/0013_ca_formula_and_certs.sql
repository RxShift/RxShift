-- California's additive ratio formula (BPC 4115) + CPhT certification flag.
--
-- formula 'flat': max counting techs = pharmacists * max_techs_per_pharmacist
-- formula 'additive': max = additive_first_techs
--                         + (pharmacists - 1) * additive_additional_techs
--   California: first RPh allows 1 tech, each additional allows 2 (2P - 1).
--
-- staff.certified: CPhT tracking. Informational today (shows in rosters and
-- compliance exports); cert-DEPENDENT ratio enforcement (Tennessee) is
-- deferred until the rule research contradiction is resolved (decisions.md).

alter table ratio_rule
  add column formula text not null default 'flat'
    check (formula in ('flat', 'additive')),
  add column additive_first_techs int,
  add column additive_additional_techs int;

alter table staff
  add column certified boolean not null default false;

-- California global seed rule (selectable at onboarding like the NV seed)
insert into ratio_rule
  (tenant_id, state, max_techs_per_pharmacist, formula,
   additive_first_techs, additive_additional_techs, source_citation, notes)
values
  (null, 'CA', 1, 'additive', 1, 2,
   'BPC 4115; AB 1503',
   'California additive formula: the first pharmacist on duty may supervise 1 technician; each additional pharmacist adds capacity for 2 more (max techs = 2 x pharmacists - 1). Clerical staff exempt.');
