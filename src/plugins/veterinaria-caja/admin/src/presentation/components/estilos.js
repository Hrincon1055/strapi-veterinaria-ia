import styled, { css } from 'styled-components';

/**
 * Estilos propios del punto de venta, sobre los tokens del tema del Design
 * System (funcionan en claro y en oscuro). Pensados para pantalla táctil:
 * botones grandes y sin depender del hover.
 */

/**
 * La pantalla entera, por encima de la navegación del panel (z-index 100 del
 * tema) y por debajo de los modales (300): así se abre "aparte" sin salir del
 * panel ni pedir otro login.
 */
export const Pantalla = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.neutral100};
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: 1.4rem;
`;

export const Barra = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[3]};
  padding: ${({ theme }) => `${theme.spaces[2]} ${theme.spaces[4]}`};
  background: ${({ theme }) => theme.colors.neutral0};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
  min-height: 56px;
  flex-wrap: wrap;
`;

export const Cuerpo = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(360px, 42%) 1fr;
  min-height: 0;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    overflow: auto;
  }
`;

export const Columna = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${({ theme, $fondo }) => ($fondo ? theme.colors.neutral0 : 'transparent')};
  border-right: ${({ theme, $borde }) => ($borde ? `1px solid ${theme.colors.neutral150}` : 'none')};
`;

export const Desplazable = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

export const LineaTicket = styled.button`
  all: unset;
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: ${({ theme }) => `${theme.spaces[2]} ${theme.spaces[4]}`};
  cursor: pointer;
  background: ${({ theme, $activa }) => ($activa ? theme.colors.primary100 : 'transparent')};
  border-left: 4px solid ${({ theme, $activa }) => ($activa ? theme.colors.primary600 : 'transparent')};
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary600}; outline-offset: -2px; }
`;

export const Teclado = styled.div`
  display: grid;
  grid-template-columns: 1.2fr repeat(3, 1fr) 1fr;
  grid-auto-rows: 52px;
  border-top: 1px solid ${({ theme }) => theme.colors.neutral150};
`;

export const Tecla = styled.button`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  border-right: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
  background: ${({ theme, $activa }) => ($activa ? theme.colors.primary100 : theme.colors.neutral0)};
  color: ${({ theme, $activa }) => ($activa ? theme.colors.primary700 : theme.colors.neutral800)};
  &:active { background: ${({ theme }) => theme.colors.neutral200}; }
  &:disabled { cursor: default; color: ${({ theme }) => theme.colors.neutral400}; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary600}; outline-offset: -2px; }
  ${({ $cobrar, theme }) => $cobrar && css`
    grid-row: span 3;
    flex-direction: column;
    font-size: 1.8rem;
    background: ${theme.colors.primary600};
    color: ${theme.colors.neutral0};
    &:active { background: ${theme.colors.primary700}; }
    &:disabled { background: ${theme.colors.neutral300}; color: ${theme.colors.neutral0}; }
  `}
`;

export const Rejilla = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spaces[2]};
  padding: ${({ theme }) => theme.spaces[3]};
`;

export const Tarjeta = styled.button`
  all: unset;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 170px;
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral150};
  overflow: hidden;
  cursor: pointer;
  &:hover:not(:disabled) { border-color: ${({ theme }) => theme.colors.primary600}; }
  &:active:not(:disabled) { transform: scale(0.98); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary600}; outline-offset: 2px; }
`;

export const Imagen = styled.div`
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme, $color }) => $color ?? theme.colors.neutral150};
  color: ${({ theme, $color }) => ($color ? theme.colors.neutral0 : theme.colors.neutral600)};
  font-size: 3.2rem;
  font-weight: 700;
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
`;

export const Total = styled.div`
  padding: ${({ theme }) => `${theme.spaces[3]} ${theme.spaces[4]}`};
  border-top: 1px solid ${({ theme }) => theme.colors.neutral150};
  text-align: right;
`;

/** Botón grande de medio de pago o de billete rápido. */
export const Opcion = styled.button`
  all: unset;
  box-sizing: border-box;
  padding: ${({ theme }) => `${theme.spaces[3]} ${theme.spaces[4]}`};
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 1px solid ${({ theme, $activa }) => ($activa ? theme.colors.primary600 : theme.colors.neutral200)};
  background: ${({ theme, $activa }) => ($activa ? theme.colors.primary100 : theme.colors.neutral0)};
  color: ${({ theme, $activa }) => ($activa ? theme.colors.primary700 : theme.colors.neutral800)};
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary600}; outline-offset: 2px; }
`;
