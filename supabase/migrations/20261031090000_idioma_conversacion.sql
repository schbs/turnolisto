-- Idioma en el que escribe cada paciente: el bot contesta en español (por defecto) o en inglés.
alter table conversaciones add column idioma text check (idioma in ('es', 'en'));
