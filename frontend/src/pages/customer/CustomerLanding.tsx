import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast';

const CustomerLanding: React.FC = () => {
    const { tableNumber } = useParams<{ tableNumber: string }>();
    const navigate = useNavigate();
    const { setTableNumber } = useCart();

    useEffect(() => {
        if (tableNumber) {
            setTableNumber(tableNumber);
            toast.success(`Welcome! You are ordering for Table ${tableNumber}`);
            navigate('/');
        } else {
            toast.error('Invalid table number');
            navigate('/');
        }
    }, [tableNumber, navigate, setTableNumber]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-brown-50">
            <div className="text-center">
                <div className="loading-spinner mb-4 mx-auto"></div>
                <h2 className="text-xl font-semibold text-gray-700">Setting up your table...</h2>
            </div>
        </div>
    );
};

export default CustomerLanding;
