import { AedexClient } from './aedex.client';
import { AedexProvider } from './aedex.provider';

const ctx = { userId: 'test' };
const item = { id: 1, slug: 'mi-serie', nombre: 'Mi serie', descripcion: 'Descripción', portada_url: 'cover-id', estado: 'Ongoing' };
const chapters = [{ numero: 2.5, titulo: 'Final', fecha_publicacion: '2026-01-01' }, { numero: 1 }];
describe('Aedex', () => {
  const fetchFn = jest.fn() as jest.MockedFunction<typeof fetch>;
  const provider = new AedexProvider(new AedexClient(fetchFn));
  beforeEach(() => fetchFn.mockReset());
  it('busca con cabeceras y normaliza portada y slug', async () => {
    fetchFn.mockResolvedValueOnce(new Response(JSON.stringify({ data: [item], page: 1, total: 1, total_pages: 1 })));
    await expect(provider.search('mi serie', ctx)).resolves.toEqual({ status: 'ok', data: [{ id: 'mi-serie', providerId: 'aedex', title: 'Mi serie', coverUrl: 'https://aedexnox.com/assets/cover-id' }] });
    const [url, options] = fetchFn.mock.calls[0]!;
    expect(new URL(String(url)).searchParams.get('search')).toBe('mi serie');
    expect(options?.headers).toEqual({ System: 'aedex', 'X-FK-Sistema': '1', Accept: 'application/json' });
  });
  it('pagina novedades usando total_pages', async () => {
    fetchFn.mockImplementation(async () => new Response(JSON.stringify({ data: [item], total_pages: 2 })));
    await expect(provider.listLatest(1, ctx)).resolves.toMatchObject({ data: { hasNextPage: true } });
    await expect(provider.listLatest(2, ctx)).resolves.toMatchObject({ data: { hasNextPage: false } });
    expect(new URL(String(fetchFn.mock.calls[1]![0])).searchParams.get('sort')).toBe('-date_created');
  });
  it('normaliza ficha y capítulos en orden', async () => {
    fetchFn.mockImplementation(async () => new Response(JSON.stringify({ ...item, capitulos: chapters })));
    await expect(provider.getSeries('mi-serie', ctx)).resolves.toMatchObject({ data: { description: 'Descripción', status: 'Ongoing' } });
    await expect(provider.listChapters('mi-serie', ctx)).resolves.toEqual({ status: 'ok', data: [{ id: '2.5', number: '2.5', title: 'Final', publishedAt: '2026-01-01' }, { id: '1', number: '1' }] });
    expect(String(fetchFn.mock.calls[0]![0])).toBe('https://aedexnox.com/api/backend/mangas/mi-serie');
  });
  it('devuelve error estable para lector y errores de fuente', async () => {
    await expect(provider.getPages('x', '1', ctx)).resolves.toMatchObject({ error: { code: 'READER_NOT_AVAILABLE' } });
    fetchFn.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(provider.getSeries('x', ctx)).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
