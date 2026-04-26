import DashboardClient from "./DashboardClient";

export function generateStaticParams() {
  return [
    { tenantId: "kinetic" },
    { tenantId: "flraquet" },
  ];
}

export default function Page({ params }: { params: { tenantId: string } }) {
  return <DashboardClient params={params} />;
}
