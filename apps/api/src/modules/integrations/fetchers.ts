import { BadRequestException } from '@nestjs/common';
import { decryptJson } from '../../common/util';
import { db } from '../../db/db';

/** What each HR system needs to connect. Shown as the sign-in form. */
export const PROVIDERS = [
  {
    id: 'workday',
    name: 'Workday',
    desc: 'Custom report (RaaS) in JSON format',
    fields: [
      { key: 'reportUrl', label: 'Report URL (JSON)', placeholder: 'https://wd3-services1.myworkday.com/ccx/service/customreport2/…?format=json' },
      { key: 'username', label: 'Integration user', placeholder: 'ISU_Vellaire' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    id: 'sap',
    name: 'SAP SuccessFactors',
    desc: 'OData API with an API user',
    fields: [
      { key: 'baseUrl', label: 'API server', placeholder: 'https://api4.successfactors.com' },
      { key: 'username', label: 'User (user@companyId)', placeholder: 'vellaire@MERIDIAN' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    desc: 'Company domain and API key',
    fields: [
      { key: 'subdomain', label: 'Company domain', placeholder: 'meridian (from meridian.bamboohr.com)' },
      { key: 'apiKey', label: 'API key', secret: true },
    ],
  },
  {
    id: 'entra',
    name: 'Microsoft Entra ID',
    desc: 'Automatic provisioning with SCIM',
    fields: [],
    scim: true,
  },
] as const;

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

async function getJson(url: string, auth: string) {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new BadRequestException('Could not reach the HR system. Check the address.');
  }
  if (res.status === 401 || res.status === 403) throw new BadRequestException('The HR system rejected these credentials');
  if (!res.ok) throw new BadRequestException(`The HR system answered ${res.status}`);
  return res.json() as Promise<any>;
}

/** Reads all worker records from the provider as flat objects. */
export async function fetchRecords(integration: any): Promise<any[]> {
  const full = await db.Integration.findById(integration._id).select('+credentials +pendingRecords').lean<any>();
  const c = decryptJson<Record<string, string>>(full?.credentials) || {};

  // Demo workspaces and SCIM keep their records on the integration itself
  if (!c || !Object.keys(c).length) return full?.pendingRecords || [];

  switch (integration.provider) {
    case 'workday': {
      const json = await getJson(c.reportUrl, basic(c.username, c.password));
      return json.Report_Entry || json.report_entry || (Array.isArray(json) ? json : []);
    }
    case 'sap': {
      const base = String(c.baseUrl).replace(/\/$/, '');
      const fields = 'userId,firstName,lastName,email,title,department,location,country,businessPhone,cellPhone,hireDate,status';
      const json = await getJson(`${base}/odata/v2/User?$format=json&$select=${fields}&$filter=status eq 'active'&$top=5000`, basic(c.username, c.password));
      return (json.d?.results || []).map(({ __metadata, ...rest }: any) => rest);
    }
    case 'bamboohr': {
      const json = await getJson(
        `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(c.subdomain)}/v1/employees/directory`,
        basic(c.apiKey, 'x'),
      );
      return json.employees || [];
    }
    default:
      return full?.pendingRecords || [];
  }
}
