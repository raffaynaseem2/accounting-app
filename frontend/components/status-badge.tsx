type Props = {
  active: boolean;
};

export default function StatusBadge({ active }: Props) {
  return (
    <span className={active ? "status-badge status-badge-active" : "status-badge status-badge-inactive"}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}
