# Supabase — fresh install

Jalankan **satu file** di Supabase SQL Editor (project baru):

```
schema.sql
```

Kalau project sudah pernah di-install **tanpa** tabel household, jalankan juga:

```
household-addon.sql
```

Untuk project existing yang masih punya tier Basic/Pro, jalankan:

```
unify-subscription-plan.sql
```

Semua tabel, RLS, trigger trial sudah ada di `schema.sql`. Tidak perlu migration terpisah.
