// Loop headers and job board names spell companies differently,
// e.g. "Verint (Verint Systems / VRNT)" vs "Verint", so compare on a normalized prefix
function companyKey(name: string) {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')
}

export function sameCompany(a: string, b: string) {
  const ka = companyKey(a), kb = companyKey(b)
  return !!ka && !!kb && (ka === kb || ka.startsWith(kb) || kb.startsWith(ka))
}
