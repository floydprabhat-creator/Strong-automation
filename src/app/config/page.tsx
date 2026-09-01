import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { PlatformTag } from "@/features/jobs/components/platform-tag";
import { listDealerships, listPlatforms } from "@/lib/data/repository";

export const metadata = { title: "Platforms — Strong Automation" };

export default async function ConfigPage() {
  const [platforms, dealerships] = await Promise.all([
    listPlatforms(),
    listDealerships(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platforms & clients"
        description="Reference data. Read-only for now — these records are seeded and edited in Appwrite."
      />

      <Card>
        <CardHeader
          title="Platforms"
          description="Five platforms, four adapters — Auto Go and Fox Dealer share the WordPress adapter."
        />
        <CardBody padded={false}>
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Platform</TH>
                  <TH>Adapter</TH>
                  <TH>Login</TH>
                  <TH>Code mapping</TH>
                </TR>
              </THead>
              <TBody>
                {platforms.map((platform) => {
                  const mappingConfirmed =
                    platform.codeMapping.html !== null ||
                    platform.codeMapping.css !== null ||
                    platform.codeMapping.js !== null;

                  return (
                    <TR key={platform.id}>
                      <TD>
                        <PlatformTag platform={platform} />
                      </TD>
                      <TD>
                        <span className="font-mono text-xs text-ink-muted">
                          {platform.adapterKey}
                        </span>
                      </TD>
                      <TD>
                        {platform.sharedLoginPortal ? (
                          <span title="Many dealerships share one login domain — Dashlane autofill must disambiguate">
                            <Badge tone="warn">shared portal</Badge>
                          </span>
                        ) : (
                          <span title="One login domain per dealership — autofill is unambiguous">
                            <Badge tone="ok">per dealership</Badge>
                          </span>
                        )}
                      </TD>
                      <TD>
                        {mappingConfirmed ? (
                          <Badge tone="ok">confirmed</Badge>
                        ) : (
                          <span title="Fill in by publishing one page by hand and recording where each piece of code goes">
                            <Badge tone="neutral">not yet confirmed</Badge>
                          </span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Clients"
          description="Client Code is the key that links Podio, the Git folder, and Dashlane."
        />
        <CardBody padded={false}>
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Client</TH>
                  <TH>Site</TH>
                  <TH>Platforms</TH>
                </TR>
              </THead>
              <TBody>
                {dealerships.map((dealership) => (
                  <TR key={dealership.id}>
                    <TD>
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                        {dealership.clientCode}
                      </span>
                    </TD>
                    <TD className="text-sm">{dealership.name}</TD>
                    <TD>
                      <a
                        href={dealership.clientUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent hover:underline"
                      >
                        {dealership.clientUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </TD>
                    <TD>
                      <span className="flex flex-wrap gap-1">
                        {dealership.platformIds.map((pid) => {
                          const platform = platforms.find((p) => p.id === pid);
                          return platform ? (
                            <Badge key={pid} tone="neutral">
                              {platform.name}
                            </Badge>
                          ) : null;
                        })}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </CardBody>
      </Card>
    </div>
  );
}
