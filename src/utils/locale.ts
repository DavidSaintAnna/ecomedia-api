import { z } from 'zod';

// All validation messages (min/max length, invalid e-mail, wrong type, ...) come out in Brazilian Portuguese
z.config(z.locales.ptBR());
