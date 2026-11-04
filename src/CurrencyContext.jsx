import { createContext, useContext } from 'react';
import { createMoneyTools } from './moneyFormat.js';

export const CurrencyContext=createContext(createMoneyTools());
export const useMoney=()=>useContext(CurrencyContext);
