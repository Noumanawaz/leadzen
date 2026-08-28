import { mapMetaError } from './meta-whatsapp.provider';

describe('mapMetaError', () => {
  it('maps expired token errors', () => {
    expect(mapMetaError({ message: 'OAuth', code: 190 })).toContain(
      'expired',
    );
  });

  it('maps template window errors', () => {
    expect(mapMetaError({ message: 'template', code: 131047 })).toContain(
      '24-hour',
    );
  });
});
