import PartyDetail from "../../../components/party-detail";
export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) { return <PartyDetail kind="suppliers" id={(await params).id} />; }
