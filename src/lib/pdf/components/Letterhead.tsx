import { Image, StyleSheet, Text, View } from '@react-pdf/renderer';

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#062746',
    paddingBottom: 10,
    marginBottom: 16,
  },
  logo: { width: 44, height: 44, marginRight: 12, objectFit: 'contain' },
  name: { fontSize: 15, fontWeight: 600, color: '#062746' },
  line: { fontSize: 8.5, color: '#44566A', marginTop: 2 },
  meta: { marginLeft: 'auto', alignItems: 'flex-end' },
});

export type LetterheadProps = {
  orgName: string;
  lines?: string[]; // address, registration numbers, PAN, 80G…
  logo?: Uint8Array | null; // PNG/JPEG bytes from storage
  reference?: string;
  date?: string;
};

/** Organisation letterhead used at the top of every generated PDF (receipts, letters, reports). */
export function Letterhead({ orgName, lines = [], logo, reference, date }: LetterheadProps) {
  return (
    <View style={s.wrap} fixed>
      {/* react-pdf <Image> renders into a PDF and has no alt attribute. */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {logo ? <Image style={s.logo} src={{ data: Buffer.from(logo), format: 'png' }} /> : null}
      <View>
        <Text style={s.name}>{orgName}</Text>
        {lines.map((l) => (
          <Text key={l} style={s.line}>
            {l}
          </Text>
        ))}
      </View>
      {(reference || date) && (
        <View style={s.meta}>
          {reference ? <Text style={s.line}>{reference}</Text> : null}
          {date ? <Text style={s.line}>{date}</Text> : null}
        </View>
      )}
    </View>
  );
}
