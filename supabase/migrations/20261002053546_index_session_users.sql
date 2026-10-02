-- Indexerar sessionsägaren för snabbare uppslag och rensning när ett konto tas bort.
CREATE INDEX IF NOT EXISTS sessions_user_idx ON private.sessions(user_id);
