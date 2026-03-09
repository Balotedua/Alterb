
  create table public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    name text,
    avatar text default '🧑',
    created_at timestamptz default now()
  );

  create or replace function public.handle_new_user()
  returns trigger as $$
  begin
    insert into public.profiles (id, name)
    values (new.id, new.raw_user_meta_data->>'name');
    return new;
  end;
  $$ language plpgsql security definer;

  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
