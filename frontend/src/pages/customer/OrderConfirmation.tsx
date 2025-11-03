import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersAPI } from '../../utils/api';
import { Order } from '../../types';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CustomerOrderConfirmation: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderNumber) {
      loadOrderDetails();
    }
  }, [orderNumber]);

  const loadOrderDetails = async () => {
    if (!orderNumber) return;

    try {
      setLoading(true);
      // Note: In a real app, you might want to create a public endpoint for order confirmation
      // For now, we'll simulate this with the order number
      setOrder({
        id: 1,
        order_number: orderNumber,
        total_amount: 0, // This would come from the API
        payment_method: 'cash',
        status: 'pending',
        is_voided: false,
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error loading order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-success-100 mb-6">
          <CheckCircleIcon className="h-12 w-12 text-success-600" />
        </div>

        {/* Confirmation Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Order Confirmed!
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Thank you for your order. We've received it and will prepare it shortly.
        </p>

        {/* Order Details */}
        {order && (
          <div className="card text-left mb-8">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Number:</span>
                  <span className="font-medium text-gray-900">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium text-gray-900 capitalize">{order.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="badge badge-info capitalize">{order.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Time:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="card mb-8 text-left">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">What's Next?</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-600">1</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Order Preparation</p>
                  <p className="text-gray-600 text-sm">Our team will start preparing your order immediately.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-600">2</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Order Ready</p>
                  <p className="text-gray-600 text-sm">We'll notify you when your order is ready for pickup.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-600">3</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Pickup</p>
                  <p className="text-gray-600 text-sm">Come to our counter and show your order number to collect your items.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Order Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderConfirmation;
