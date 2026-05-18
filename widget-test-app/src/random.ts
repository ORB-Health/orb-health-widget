/** Random data generators used by the "Randomize" buttons in the forms. */

const FIRST_NAMES_M = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Charles', 'Thomas', 'Daniel']
const FIRST_NAMES_F = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris']
const STREETS = ['Main Street', 'High Street', 'Church Road', 'Park Lane', 'Mill Road', 'Queens Road', 'Kings Way', 'Station Road', 'Manor Drive']
const TOWNS = ['Springfield', 'Riverdale', 'Greenfield', 'Lakeside', 'Hillcrest', 'Kingsbury', 'Ashford', 'Oakwood']
const ORG_SUFFIXES = ['Medical Centre', 'Clinic', 'Health Practice', 'Surgery', 'Healthcare', 'GP Practice', 'Medical Group']
const ORG_PREFIXES = ['Riverside', 'Parkside', 'Oakwood', 'Meadowbrook', 'Greenfield', 'Highpoint', 'Westside', 'Sunrise']
const TITLES_M = ['Mr', 'Dr']
const TITLES_F = ['Mrs', 'Miss', 'Ms', 'Dr']
const POSTCODE_LETTERS = 'ABCDEFGHJKMNOPRSTUVWXYZ'

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(n: number): number { return Math.floor(Math.random() * n) }
function shortId(): string { return Math.random().toString(36).slice(2, 8).toUpperCase() }

function randomPostcode(): string {
  const l1 = POSTCODE_LETTERS[randInt(POSTCODE_LETTERS.length)]
  const l2 = POSTCODE_LETTERS[randInt(POSTCODE_LETTERS.length)]
  const l3 = POSTCODE_LETTERS[randInt(POSTCODE_LETTERS.length)]
  const l4 = POSTCODE_LETTERS[randInt(POSTCODE_LETTERS.length)]
  return `${l1}${l2}${randInt(9) + 1} ${randInt(9) + 1}${l3}${l4}`
}
function randomPhone(): string {
  let n = '07'
  for (let i = 0; i < 9; i++) n += randInt(10)
  return n
}
function randomDob(): string {
  const year = 1945 + randInt(65)
  const month = String(randInt(12) + 1).padStart(2, '0')
  const day = String(randInt(28) + 1).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function randomEmail(first: string, last: string): string {
  return `${first.toLowerCase()}.${last.toLowerCase()}${randInt(1000)}@example.test`
}
function randomRegNumber(): string {
  return `GMC${1000000 + randInt(9000000)}`
}
function randomCqcNumber(): string {
  return `1-${1000000000 + randInt(9000000000)}`
}

export interface OrgRandom {
  id: string; name: string; address1: string; address2: string
  address3: string; address4: string
  postcode: string; phoneNumber: string; cqc: string
  signatoryName: string; signatoryEmail: string
}
export function randomOrgData(): OrgRandom {
  const prefix = pick(ORG_PREFIXES)
  const suffix = pick(ORG_SUFFIXES)
  const signFirst = pick([...FIRST_NAMES_M, ...FIRST_NAMES_F])
  const signLast = pick(LAST_NAMES)
  return {
    id: `ORG-${shortId()}`,
    name: `${prefix} ${suffix}`,
    address1: `${randInt(200) + 1} ${pick(STREETS)}`,
    address2: pick(TOWNS),
    address3: '',
    address4: '',
    postcode: randomPostcode(),
    phoneNumber: randomPhone(),
    cqc: randomCqcNumber(),
    signatoryName: `${signFirst} ${signLast}`,
    signatoryEmail: randomEmail(signFirst, signLast)
  }
}

export interface UserRandom {
  id: string; firstName: string; lastName: string; regNum: string; email: string
}
export function randomUserData(): UserRandom {
  const isMale = Math.random() < 0.5
  const firstName = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F)
  const lastName = pick(LAST_NAMES)
  return {
    id: `USR-${shortId()}`,
    firstName, lastName,
    regNum: randomRegNumber(),
    email: randomEmail(firstName, lastName)
  }
}

export interface PatientRandom {
  id: string; title: string; firstName: string; lastName: string
  dob: string; sex: string; email: string; postcode: string
}
export function randomPatientData(): PatientRandom {
  const isMale = Math.random() < 0.5
  const firstName = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F)
  const lastName = pick(LAST_NAMES)
  return {
    id: `PAT-${shortId()}`,
    title: pick(isMale ? TITLES_M : TITLES_F),
    firstName, lastName,
    dob: randomDob(),
    sex: isMale ? 'Male' : 'Female',
    email: randomEmail(firstName, lastName),
    postcode: randomPostcode()
  }
}
