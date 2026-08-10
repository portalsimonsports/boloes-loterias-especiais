-- Remove valores legados que não são telefones válidos (e-mail/nome em coluna de celular).
update public.usuarios set telefone=null where telefone is not null and telefone !~ '^[+0-9 ()-]+$';
