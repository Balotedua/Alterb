import { KPICards } from '@/components/finance/KPICards';
import { TransactionForm } from '@/components/finance/TransactionForm';
import { TransactionList } from '@/components/finance/TransactionList';

export default function Finance() {
  return (
    <div className="page page--finance">
      <h1>Finanze</h1>
      <KPICards />
      <TransactionForm />
      <TransactionList />
    </div>
  );
}
