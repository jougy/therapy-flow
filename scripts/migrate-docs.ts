import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching clinics...");
  const { data: clinics, error } = await supabase.from("clinics").select("id, cnpj, account_owner_user_id");
  if (error) {
    console.error("Error fetching clinics:", error);
    return;
  }

  let cpfCount = 0;
  let cnpjCount = 0;

  for (const clinic of clinics) {
    if (!clinic.cnpj) continue;
    
    const cleanDoc = clinic.cnpj.replace(/\D/g, "");
    
    if (cleanDoc.length === 11) {
      console.log(`Migrating CPF for clinic ${clinic.id}`);
      if (clinic.account_owner_user_id) {
        // Move to profiles
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ cpf: cleanDoc })
          .eq("id", clinic.account_owner_user_id);
          
        if (profileError) console.error("Error updating profile:", profileError);
      }
      
      // Clear from clinics since it's a CPF
      const { error: clinicError } = await supabase
        .from("clinics")
        .update({ cnpj: null })
        .eq("id", clinic.id);
        
      if (clinicError) console.error("Error clearing clinic cnpj:", clinicError);
      else cpfCount++;
      
    } else if (cleanDoc.length === 14) {
      console.log(`Standardizing CNPJ for clinic ${clinic.id}`);
      // Standardize to digits only
      const { error: clinicError } = await supabase
        .from("clinics")
        .update({ cnpj: cleanDoc })
        .eq("id", clinic.id);
        
      if (clinicError) console.error("Error updating clinic cnpj:", clinicError);
      else cnpjCount++;
    }
  }
  
  console.log(`Migration complete. Migrated ${cpfCount} CPFs and standardized ${cnpjCount} CNPJs.`);
}

main();
