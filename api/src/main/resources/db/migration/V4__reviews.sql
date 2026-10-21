create table review (
  id uuid primary key,
  contract_id uuid not null unique references contract(id) on delete cascade,
  service_id uuid not null references service_listing(id),
  client_id uuid not null references app_user(id),
  freelancer_id uuid not null references app_user(id),
  rating int not null check (rating between 1 and 5),
  comment varchar(500) not null default '',
  reply varchar(200),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_review_freelancer_created on review (freelancer_id, created_at desc);
create index idx_review_service_created on review (service_id, created_at desc);
