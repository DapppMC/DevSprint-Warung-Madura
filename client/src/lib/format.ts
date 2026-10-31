const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID');

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeZone: 'Asia/Jakarta',
});

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return rupiahFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
