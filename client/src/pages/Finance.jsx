import KPICards from '../components/finance/KPICards';
import TransactionList from '../components/finance/TransactionList';
import TransactionForm from '../components/finance/TransactionForm';

export default function Finance() {
  return (
    <div className="page page--finance">
      <h1>Finance</h1>
      <KPICards />
      <TransactionForm />
      <TransactionList />
    </div>
  );
}
