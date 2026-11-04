type Group = { _id?: string; name?: string };
type Membership = {
  serviceUnitIds?: Group[];
  serviceUnitId?: Group;
  serviceUnitInterest?: string;
};

export function memberGroupNames(member: Membership) {
  if (Array.isArray(member.serviceUnitIds))
    return member.serviceUnitIds
      .map((unit) => unit?.name)
      .filter(Boolean)
      .join("; ");
  return member.serviceUnitId?.name || member.serviceUnitInterest || "";
}
export function memberGroupIds(member: Membership) {
  if (Array.isArray(member.serviceUnitIds))
    return member.serviceUnitIds
      .map((unit) => unit?._id)
      .filter((id): id is string => !!id);
  return member.serviceUnitId?._id ? [member.serviceUnitId._id] : [];
}
