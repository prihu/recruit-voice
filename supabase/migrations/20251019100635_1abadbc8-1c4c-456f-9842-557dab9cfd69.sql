-- Add foreign key constraint from bulk_operations to roles
ALTER TABLE bulk_operations
ADD CONSTRAINT bulk_operations_role_id_fkey
FOREIGN KEY (role_id)
REFERENCES roles(id)
ON DELETE CASCADE;

-- Add index on role_id for better query performance
CREATE INDEX IF NOT EXISTS idx_bulk_operations_role_id 
ON bulk_operations(role_id);