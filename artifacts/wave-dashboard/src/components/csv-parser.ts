import { SessionInput, SessionInputWaveDirection } from "@workspace/api-client-react";

export function parseCSV(csvContent: string): { rows: SessionInput[], errors: string[] } {
  const rows: SessionInput[] = [];
  const errors: string[] = [];
  
  if (!csvContent || !csvContent.trim()) {
    return { rows, errors: ["Empty CSV content"] };
  }

  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows, errors: ["CSV must contain a header row and at least one data row"] };
  }

  const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
  
  const requiredHeaders = ["date", "time", "title", "wave_direction", "capacity_booked", "capacity_available"];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    return { rows, errors: [`Missing required columns: ${missingHeaders.join(", ")}`] };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(",").map(v => v.trim());
    
    try {
      const getValue = (header: string) => values[headers.indexOf(header)];
      
      const date = getValue("date");
      const time = getValue("time");
      const title = getValue("title");
      const rawWaveDir = getValue("wave_direction").toLowerCase();
      const wave_direction = (rawWaveDir === "left" ? "left" : "right") as SessionInputWaveDirection;
      const capacity_booked = parseInt(getValue("capacity_booked"), 10);
      const capacity_available = parseInt(getValue("capacity_available"), 10);
      
      if (!date || !time || !title || isNaN(capacity_booked) || isNaN(capacity_available)) {
        errors.push(`Row ${i}: Invalid data format`);
        continue;
      }
      
      rows.push({
        date,
        time,
        title,
        wave_direction,
        capacity_booked,
        capacity_available
      });
    } catch (e) {
      errors.push(`Row ${i}: Failed to parse`);
    }
  }

  return { rows, errors };
}
