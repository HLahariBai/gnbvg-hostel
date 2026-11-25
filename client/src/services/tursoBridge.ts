// =============================================================
// GNBVG Hostel - Universal Turso Cloud Direct Bridge
// Allows 100% Serverless execution on GitHub Pages (Zero PC, Zero Cloud Host)
// Direct HTTPS pipeline to Turso Cloud (aws-ap-south-1 Mumbai)
// =============================================================

const TURSO_URL = 'https://gnbvg-hostel-hlaharibai.aws-ap-south-1.turso.io/v2/pipeline';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTU0NTQ1MTgsImlkIjoiMDFhMjA5NmQtMzQwMS03YmI3LTgyMmMtZWFjZGJjODQxMmZhIiwia2lkIjoiX2FYcTJZMVRFdW4zbGVwTVhGS0FBT241blE2X3V3NGo5am9MOVg0M1k0VSIsInJpZCI6IjYyZDI1NWYxLTA1ZmItNDM4Zi05ZWJjLTZmZjZjNDdkZThhNiJ9.i29MHw9Zt9k1P4Q-RQFMOmB6cpYzLq_9SdLG_KuX2HsCOlo2D2UIQGbpEpflw0VSII904ZsxD-pFt4ijUuJyCA';

export async function executeTursoQuery(sql: string, args: any[] = []): Promise<any[]> {
  const formattedArgs = args.map((a) => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number') {
      return Number.isInteger(a) ? { type: 'integer', value: String(a) } : { type: 'float', value: a };
    }
    return { type: 'text', value: String(a) };
  });

  const requests = [
    { type: 'execute', stmt: { sql, args: formattedArgs } },
    { type: 'close' },
  ];

  const res = await fetch(TURSO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    throw new Error(`Turso Error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const execResult = data.results?.[0]?.response?.result;
  if (!execResult) return [];

  const cols = execResult.cols?.map((c: any) => c.name) || [];
  const rows = execResult.rows || [];

  return rows.map((r: any[]) => {
    const obj: any = {};
    cols.forEach((col: string, idx: number) => {
      obj[col] = r[idx]?.value !== undefined ? r[idx].value : null;
    });
    return obj;
  });
}

export function isStaticDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('github.io') || host.includes('pages.dev') || host.includes('vercel.app') || window.location.protocol === 'file:';
}
