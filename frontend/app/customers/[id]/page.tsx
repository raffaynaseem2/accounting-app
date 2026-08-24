import PartyDetail from "../../../components/party-detail";
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) { return <PartyDetail kind="customers" id={(await params).id} />; }
